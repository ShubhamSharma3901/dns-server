//Lib Imports
import * as dgram from "dgram";

//Custom Imports
import { DNSHeader } from "../lib/headers.class";
import type { DNSHeaderType } from "../types/headers";

console.log("Logs from the program:");

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
	try {
		const parsedHeaderData: DNSHeaderType = {
			pid: data.readUInt16BE(0),
			qr: (data.readUInt16BE(2) >> 15) & 0x1,
			opcode: (data.readUInt16BE(2) >> 11) & 0b00001111,
			aa: (data.readUInt16BE(2) >> 10) & 0x1,
			tc: (data.readUInt16BE(2) >> 9) & 0x1,
			rd: (data.readUInt16BE(2) >> 8) & 0x1,
			ra: (data.readUInt16BE(2) >> 7) & 0x1,
			z: (data.readUInt16BE(2) >> 4) & 0b00000111,
			rcode: data.readUInt16BE(2) & 0b00001111,
			qdcount: data.readUInt16BE(4),
			ancount: data.readUInt16BE(6),
			nscount: data.readUInt16BE(8),
			arcount: data.readUInt16BE(10),
		};
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
			qdcount: 0,
			ancount: 0,
			nscount: 0,
			arcount: 0,
		};
		const header = new DNSHeader(headerData);
		console.log(`Received data from ${remoteAddr.address}:${remoteAddr.port}`);
		const response = header.getHeaderBuffer();
		console.log(`Response: ${response}`);
		udpSocket.send(response, remoteAddr.port, remoteAddr.address);
	} catch (e) {
		console.log(`Error sending data: ${e}`);
	}
});
