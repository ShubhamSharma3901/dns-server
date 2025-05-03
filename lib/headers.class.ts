import type { DNSHeaderType } from "../types/headers";
export class DNSHeader {
	private headerBuffer: Uint16Array = new Uint16Array(12);

	constructor(data: DNSHeaderType) {
		this.headerBuffer.set([data.pid], 0);
		this.headerBuffer.set(
			[data.qr, data.opcode, data.aa, data.tc, data.ra, data.z, data.rcode],
			2
		);
		this.headerBuffer.set([data.qdcount], 4);
		this.headerBuffer.set([data.ancount], 6);
		this.headerBuffer.set([data.nscount], 8);
		this.headerBuffer.set([data.arcount], 10);
	}

	public getHeaderBuffer(): Buffer {
		const buffer = Buffer.alloc(12);
		this.headerBuffer.forEach((value, index) => {
			buffer.writeUInt16BE(value, index * 2);
		});
		return buffer;
	}
}
