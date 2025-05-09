//Package Imports
import * as dgram from "dgram";

//Custom Imports
import type { DNSHeaderType } from "../types/headers";
import type { DNSAnswerType } from "../types/answers";
import { DNSHeader } from "../classes/headers.class";
import { DNSQuestion } from "../classes/questions.class";
import { DNSAnswer } from "../classes/answers.class";
import {
	parseDNSHeader,
	parseDNSHeaderSelective,
} from "../lib/utils/headers.utils";
import { parseDNSQuestion } from "../lib/utils/questions.utils";
import { parseDNSAnswer } from "../lib/utils/answers.utils";

console.log("Logs from the program:");

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
	try {
		const parsedHeaderData = parseDNSHeader(data);

		//Parse DNS Question Section
		// The question section starts after the header, which is 12 bytes long
		let questionSectionOffset = 12;
		let parsedQuestions = [];
		for (let i = 0; i < parsedHeaderData.qdcount; i++) {
			// Parse DNS Question Section
			const questionParsed = parseDNSQuestion(
				data.subarray(questionSectionOffset)
			);
			parsedQuestions.push(questionParsed);
			questionSectionOffset += questionParsed.bytesUsed;
		}

		const finalParsedQuestion = parsedQuestions.map((questionParsed) => {
			return {
				name: questionParsed.name,
				type: questionParsed.type,
				class: questionParsed.class,
			};
		});

		// Parse DNS Answer Section
		const generateAnswersFromParsedQuestions = finalParsedQuestion.map(
			(questionParsed) => {
				return {
					name: questionParsed.name,
					type: 1,
					class: 1,
					ttl: 60,
					length: 4,
					data: "8.8.8.8",
				};
			}
		);

		const header = new DNSHeader();
		parsedHeaderData.qdcount = finalParsedQuestion.length;
		parsedHeaderData.qr = 1;
		parsedHeaderData.rcode = 4;
		parsedHeaderData.ancount = generateAnswersFromParsedQuestions.length;
		header.writeHeader(parsedHeaderData);
		const headerBuffer = header.getHeaderBuffer();

		const questionBuffer: Buffer[] = finalParsedQuestion.map((question) => {
			const questions = new DNSQuestion();
			questions.writeQuestion(question);
			return questions.getQuestionBuffer();
		});

		const answerBuffer: Buffer[] = generateAnswersFromParsedQuestions.map(
			(answer) => {
				const answers = new DNSAnswer();
				answers.writeAnswer(answer);
				return answers.getAnswerBuffer();
			}
		);

		// Generating the response by concatenating all the Packet Sections
		// Header + Question + Answer + Authority + Additional
		const response = Buffer.concat([
			headerBuffer,
			...questionBuffer,
			...answerBuffer,
		]);

		console.log("Header Buffer: ", headerBuffer);
		console.log("Question Buffer: ", questionBuffer);
		console.log("Answer Buffer: ", answerBuffer);
		console.log(`Received data from ${remoteAddr.address}:${remoteAddr.port}`);
		console.log(`Response: ${response}`);

		// Send the response back to the client
		udpSocket.send(response, remoteAddr.port, remoteAddr.address);
	} catch (e) {
		console.log(`Error sending data: ${e}`);
	}
});
