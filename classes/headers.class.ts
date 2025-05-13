import type { DNSHeaderType } from "../types/headers";
export class DNSHeader {
	private headerBuffer: Uint16Array = new Uint16Array(6);
	private static instance: DNSHeader = new DNSHeader();
	constructor() {}

	/**
	 * Returns the singleton instance of DNSHeader.
	 * @returns {DNSHeader} The singleton instance of DNSHeader.
	 */
	public static getInstance(): DNSHeader {
		if (!this.instance) {
			this.instance = new DNSHeader();
		}
		return this.instance;
	}

	/**
	 * Writes the DNS header with the provided Buffer Data.
	 * @param {DNSHeaderType}
	 * @returns {void}
	 */
	public writeHeader(data: DNSHeaderType): void {
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

	/**
	 * Returns the header buffer as a Buffer object.
	 * @returns {Buffer} The header buffer.
	 */
	public getHeaderBuffer(): Buffer {
		const buffer = Buffer.alloc(12);
		this.headerBuffer.forEach((value, index) => {
			buffer.writeUInt16BE(value, index * 2);
		});
		return buffer;
	}
}
