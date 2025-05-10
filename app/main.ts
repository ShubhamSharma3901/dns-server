// ───────────────────── Package Imports ─────────────────────
import * as dgram from "dgram";

// ───────────────────── Custom Imports ─────────────────────
import type { DNSHeaderType } from "../types/headers";
import type { DNSAnswerType } from "../types/answers";
import type { QuestionType } from "../types/questions";
import { DNSHeader } from "../classes/headers.class";
import { DNSQuestion } from "../classes/questions.class";
import { DNSAnswer } from "../classes/answers.class";
import { parseDNSHeader } from "../lib/utils/headers.utils";
import { parseDNSQuestion } from "../lib/utils/questions.utils";
import { estimateUncompressedNameLength } from "../lib/utils/common.utils";

// ───────────────────── Server Setup ─────────────────────
const udpSocket = dgram.createSocket("udp4");
const PORT = Number(process.env.PORT) || 2053;
const HOST = process.env.HOST_NAME || "127.0.0.1";

udpSocket.bind(PORT, HOST, () => {
	console.log(`DNS server running at ${HOST}:${PORT}`);
});

// ───────────────────── Message Handler ─────────────────────
udpSocket.on("message", (data: Buffer, remote: dgram.RemoteInfo) => {
	try {
		console.log(`\nReceived DNS query from ${remote.address}:${remote.port}`);

		// ───── Step 1: Parse Header ─────
		const parsedHeader: DNSHeaderType = parseDNSHeader(data);
		let offset = 12; // DNS header is 12 bytes
		const questions: QuestionType[] = [];

		// ───── Step 2: Parse All Questions ─────
		for (let i = 0; i < parsedHeader.qdcount; i++) {
			// Use the enhanced parsing function with compression support
			const {
				name,
				type,
				class: qClass,
				bytesUsed,
			} = parseDNSQuestion(data, offset);
			questions.push({ name, type, class: qClass });
			offset += bytesUsed;
		}

		// ───── Step 3: Construct the Response Message with Compression ─────
		// Create a compression context (nameMap) for the response message
		const nameMap = new Map<string, number>();

		// ───── Step 4: Construct Header for Response ─────
		const responseHeader = new DNSHeader();
		responseHeader.writeHeader({
			...parsedHeader,
			qr: 1, // Response
			rcode: 4, // No error
			ancount: questions.length, // Number of answers
		});
		const headerBuffer = responseHeader.getHeaderBuffer();

		// Start of the message, position after header
		let currentPosition = headerBuffer.length;

		// ───── Step 5: Encode Questions with Compression ─────
		const questionBuffers = questions.map((q) => {
			const question = new DNSQuestion();
			// Pass the nameMap and current position to enable compression
			const bytesWritten = question.writeQuestion(q, nameMap, currentPosition);
			const qBuffer = question.getQuestionBuffer();
			currentPosition += bytesWritten;
			return qBuffer;
		});

		// ───── Step 6: Create Fake Answer(s) ─────
		const answers: DNSAnswerType[] = questions.map((q) => ({
			name: q.name,
			type: 1, // A record
			class: 1, // IN
			ttl: 60,
			length: 4,
			data: "8.8.8.8",
		}));

		// ───── Step 7: Encode Answer Section with Compression ─────
		const answerBuffers = answers.map((ans) => {
			const answer = new DNSAnswer();
			// Pass the nameMap to enable compression
			const bytesWritten = answer.writeAnswer(ans, nameMap, currentPosition);
			const ansBuffer = answer.getAnswerBuffer();
			currentPosition += bytesWritten;
			return ansBuffer;
		});

		// ───── Step 8: Send the Compressed Response ─────
		const response = Buffer.concat([
			headerBuffer,
			...questionBuffers,
			...answerBuffers,
		]);
		udpSocket.send(response, remote.port, remote.address);

		// ───── Logs ─────
		console.log("nameMap contents:", [...nameMap.entries()]);
		console.log("Answer Buffers:", answerBuffers);
		console.log("Parsed Questions:", questions);
		console.log("Sent Response with", answers.length, "Answer(s)");
		console.log("Response Buffer Length:", response.length);

		// Estimating what the buffer would look like if no compression was used
		// -----------Compression savings---------------
		const estimatedUncompressedSize =
			12 + // DNS header
			questions.reduce(
				(acc, q) => acc + estimateUncompressedNameLength(q.name) + 4,
				0
			) + // +4 for type + class
			answers.reduce(
				(acc, a) =>
					acc + estimateUncompressedNameLength(a.name) + 10 + a.length,
				0
			); // +10 for fixed RR fields

		const actualSize = response.length;
		const savings = estimatedUncompressedSize - actualSize;
		const percent = Math.round((savings / estimatedUncompressedSize) * 100);

		console.log(
			`[Compression] Estimated: ${estimatedUncompressedSize}, Actual: ${actualSize}, Savings: ${percent}%`
		);
	} catch (err) {
		console.error("Error processing DNS query:", err);
	}
});
