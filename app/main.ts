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
		const parsedHeaderData = parseDNSHeaderSelective(data);

		//Parse DNS Question Section
		// The question section starts after the header, which is 12 bytes long
		const questionSectionOffset = 12;
		const questionParsed = parseDNSQuestion(
			data.subarray(questionSectionOffset)
		);
		const finalParsedQuestion = {
			name: questionParsed.name,
			type: questionParsed.type,
			class: questionParsed.class,
		};

		// The parsed question length is the length of the name + 2 bytes for QTYPE + 2 bytes for QCLASS
		const questionLengthInBytes = questionParsed.bytesUsed;

		// The answer section starts after the question section at the below offset
		const answerSectionOffset = questionSectionOffset + questionLengthInBytes;
		// Parse DNS Answer Section
		const parsedAnswerData = parseDNSAnswer(data.subarray(answerSectionOffset));

		const header = new DNSHeader();
		header.writeHeader(parsedHeaderData);

		const questions = new DNSQuestion();
		questions.writeQuestion(finalParsedQuestion);

		const answers = new DNSAnswer();
		answers.writeAnswer(parsedAnswerData);

		const headerBuffer = header.getHeaderBuffer();
		const questionBuffer = questions.getQuestionBuffer();
		const answerBuffer = answers.getAnswerBuffer();

		// Generating the response by concatenating all the Packet Sections
		// Header + Question + Answer + Authority + Additional
		const response = Buffer.concat([
			headerBuffer,
			questionBuffer,
			answerBuffer,
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
