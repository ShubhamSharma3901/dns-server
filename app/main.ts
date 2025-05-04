//Lib Imports
import * as dgram from "dgram";

//Custom Imports
import { DNSHeader } from "../lib/headers.class";
import type { DNSHeaderType } from "../types/headers";
import { parseDNSHeader } from "../lib/utils/headers.utils";
import { DNSQuestion } from "../lib/questions.class";

console.log("Logs from the program:");

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
	try {
		const parsedHeaderData: DNSHeaderType = parseDNSHeader(data);

		const headerData: DNSHeaderType = {
			pid: 1234,
			qr: 1,
			opcode: 0,
			aa: 0,
			tc: 0,
			rd: 0,
			ra: 0,
			z: 0,
			rcode: 0,
			qdcount: 1,
			ancount: 0,
			nscount: 0,
			arcount: 0,
		};

		const header = new DNSHeader();
		header.writeHeader(headerData);

		const questions = new DNSQuestion();
		questions.writeQuestion({
			name: "codecrafters.io",
			type: 1,
			class: 1,
		});

		const headerBuffer = header.getHeaderBuffer();
		console.log("Header Buffer: ", headerBuffer);

		const questionBuffer = questions.getQuestionBuffer();
		console.log("Question Buffer: ", questionBuffer);

		console.log(`Received data from ${remoteAddr.address}:${remoteAddr.port}`);

		const response = Buffer.concat([headerBuffer, questionBuffer]);
		console.log(`Response: ${response}`);

		udpSocket.send(response, remoteAddr.port, remoteAddr.address);
	} catch (e) {
		console.log(`Error sending data: ${e}`);
	}
});
