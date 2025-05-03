import type { DNSHeaderType } from "../types/headers";
export class DNSHeader {
	private headerBuffer: Uint16Array = new Uint16Array(6);

	constructor(data: DNSHeaderType) {
		const flags =
			(data.qr << 15) |
			(data.opcode << 11) |
			(data.aa << 10) |
			(data.tc << 9) |
			(data.rd << 8) |
			(data.ra << 7) |
			(data.z << 4) |
			data.rcode;

		this.headerBuffer.set([
			data.pid,
			flags,
			data.qdcount,
			data.ancount,
			data.nscount,
			data.arcount,
		]);
	}

	public getHeaderBuffer(): Buffer {
		const buffer = Buffer.alloc(12);
		this.headerBuffer.forEach((value, index) => {
			buffer.writeUInt16BE(value, index * 2);
		});
		return buffer;
	}
}
