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
		console.log(
			`\n📨 Received DNS query from ${remote.address}:${remote.port}`
		);

		// ───── Step 1: Parse Header ─────
		const parsedHeader = parseDNSHeader(data);
		let offset = 12; // DNS header is 12 bytes
		const questions = [];

		// ───── Step 2: Parse All Questions ─────
		for (let i = 0; i < parsedHeader.qdcount; i++) {
			const {
				name,
				type,
				class: qClass,
				bytesUsed,
			} = parseDNSQuestion(data.subarray(offset));
			questions.push({ name, type, class: qClass });
			offset += bytesUsed;
		}

		// ───── Step 3: Construct Fake Answer(s) ─────
		const answers: DNSAnswerType[] = questions.map((q) => ({
			name: q.name,
			type: 1, // A record
			class: 1, // IN
			ttl: 60,
			length: 4,
			data: "8.8.8.8",
		}));

		// ───── Step 4: Construct Header for Response ─────
		const responseHeader = new DNSHeader();
		responseHeader.writeHeader({
			...parsedHeader,
			qr: 1, // Response
			rd: 0, // Recursion Not Desired
			ra: 0, // Recursion Not Available
			rcode: 4, // Not Implemented
			ancount: answers.length,
			nscount: 0,
			arcount: 0,
		});
		const headerBuffer = responseHeader.getHeaderBuffer();

		// ───── Step 5: Encode Question Section ─────
		const questionBuffers = questions.map((q) => {
			const question = new DNSQuestion();
			question.writeQuestion(q);
			return question.getQuestionBuffer();
		});

		// ───── Step 6: Encode Answer Section ─────
		const answerBuffers = answers.map((ans) => {
			const answer = new DNSAnswer();
			answer.writeAnswer(ans);
			return answer.getAnswerBuffer();
		});

		// ───── Step 7: Send the Response ─────
		const response = Buffer.concat([
			headerBuffer,
			...questionBuffers,
			...answerBuffers,
		]);
		udpSocket.send(response, remote.port, remote.address);

		// ───── Logs ─────
		console.log("Parsed Questions:", questions);
		console.log("Sent Response with", answers.length, "Answer(s)");
		console.log("Response Buffer:", response);
		console.log("Response Sent to:", remote.address, ":", remote.port);
		console.log("Response Buffer Length:", response.length);
		console.log("Response Buffer (UTF-8):", response.toString("utf-8"));
	} catch (err) {
		console.error("Error processing DNS query:", err);
	}
});
