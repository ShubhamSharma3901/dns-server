// ───────────────────── Package Imports ─────────────────────
import * as dgram from "dgram";

// ───────────────────── Custom Imports ─────────────────────
import type { DNSHeaderType } from "../types/headers";
import type { DNSAnswerType } from "../types/answers";
import { DNSHeader } from "../classes/headers.class";
import { DNSQuestion } from "../classes/questions.class";
import { DNSAnswer } from "../classes/answers.class";
import { parseDNSHeader } from "../lib/utils/headers.utils";
import { parseDNSQuestion } from "../lib/utils/questions.utils";
import type { QuestionType } from "../types/questions";

// ───────────────────── Server Setup ─────────────────────
const udpSocket = dgram.createSocket("udp4");
const PORT = 2053;
const HOST = "127.0.0.1";

udpSocket.bind(PORT, HOST, () => {
	console.log(`🚀 DNS server running at ${HOST}:${PORT}`);
});

// ───────────────────── Message Handler ─────────────────────
udpSocket.on("message", (data: Buffer, remote: dgram.RemoteInfo) => {
	try {
		console.log(`\nReceived DNS query from ${remote.address}:${remote.port}`);

		// ───── Step 1: Parse Header ─────
		const parsedHeader: DNSHeaderType = parseDNSHeader(data);
		console.log("Parsed Header:", parsedHeader);

		let offset = 12; // DNS header is 12 bytes
		const questions: QuestionType[] = [];

		// ───── Step 2: Parse All Questions ─────
		for (let i = 0; i < parsedHeader.qdcount; i++) {
			const {
				name,
				type,
				class: qClass,
				bytesUsed,
			} = parseDNSQuestion(data.subarray(offset), data);
			questions.push({ name, type, class: qClass });
			offset += bytesUsed;
		}

		console.log("Parsed Questions:", questions);

		// ───── Step 3: Construct Response Message ─────

		// Create header for response
		const responseHeader = new DNSHeader();
		responseHeader.writeHeader({
			...parsedHeader,
			qr: 1, // Response
			ancount: questions.length, // One answer per question
			rcode: 0, // No error
		});

		// Get the header buffer - always 12 bytes
		const headerBuffer = responseHeader.getHeaderBuffer();

		// Prepare question section
		const questionBuffers: Buffer[] = [];

		// Build answers
		const answers: DNSAnswerType[] = questions.map((q) => ({
			name: q.name,
			type: 1, // A record
			class: 1, // IN
			ttl: 60,
			length: 4,
			data: "8.8.8.8",
		}));

		const answerBuffers: Buffer[] = [];

		// Create the overall response buffer
		// IMPORTANT: In this fixed implementation, we do NOT use compression
		// in the question section of the response to avoid issues with dig
		for (let i = 0; i < questions.length; i++) {
			// Encode question (without compression)
			const question = new DNSQuestion();
			question.writeQuestion(questions[i]);
			questionBuffers.push(question.getQuestionBuffer());

			// Encode answer (without compression)
			const answer = new DNSAnswer();
			answer.writeAnswer(answers[i]);
			answerBuffers.push(answer.getAnswerBuffer());
		}

		// Combine all buffers
		const response = Buffer.concat([
			headerBuffer,
			...questionBuffers,
			...answerBuffers,
		]);

		// ───── Step 4: Send Response ─────
		udpSocket.send(response, remote.port, remote.address);

		// ───── Logs ─────
		console.log("Sent Response with", answers.length, "Answer(s)");
		console.log("Response Buffer Length:", response.length);
	} catch (err) {
		console.error("Error processing DNS query:", err);
	}
});
