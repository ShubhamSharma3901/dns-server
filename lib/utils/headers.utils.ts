import type { DNSHeaderType } from "../../types/headers";

//Get the header buffer from the DNS packet
export const parseDNSHeader = (buffer: Buffer): DNSHeaderType => {
	const parsedHeaderData: DNSHeaderType = {
		pid: buffer.readUInt16BE(0),
		qr: (buffer.readUInt16BE(2) >> 15) & 0x1,
		opcode: (buffer.readUInt16BE(2) >> 11) & 0b00001111,
		aa: (buffer.readUInt16BE(2) >> 10) & 0x1,
		tc: (buffer.readUInt16BE(2) >> 9) & 0x1,
		rd: (buffer.readUInt16BE(2) >> 8) & 0x1,
		ra: (buffer.readUInt16BE(2) >> 7) & 0x1,
		z: (buffer.readUInt16BE(2) >> 4) & 0b00000111,
		rcode: buffer.readUInt16BE(2) & 0b00001111,
		qdcount: buffer.readUInt16BE(4),
		ancount: buffer.readUInt16BE(6),
		nscount: buffer.readUInt16BE(8),
		arcount: buffer.readUInt16BE(10),
	};

	return parsedHeaderData;
};
