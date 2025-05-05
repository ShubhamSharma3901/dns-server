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

console.log("Logs from the program:");

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
	try {
		const parsedHeaderData = parseDNSHeaderSelective(data);
		const header = new DNSHeader();
		header.writeHeader(parsedHeaderData);

		const questions = new DNSQuestion();
		questions.writeQuestion({
			name: "codecrafters.io",
			type: 1,
			class: 1,
		});

		const answers = new DNSAnswer();
		answers.writeAnswer({
			name: "codecrafters.io",
			type: 1,
			class: 1,
			ttl: 60,
			length: 4,
			data: "8.8.8.8",
		});

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
