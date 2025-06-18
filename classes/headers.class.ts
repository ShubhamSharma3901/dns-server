/**
 * DNS Header Class
 *
 * Implements a class for handling DNS message headers according to RFC 1035.
 * Manages the 12-byte DNS header structure with support for all standard header fields.
 */

import type { DNSHeaderType } from "../types/headers";

export class DNSHeader {
	private headerBuffer: Uint16Array = new Uint16Array(6);

	constructor() {}

	/**
	 * Writes DNS header data to the internal buffer
	 *
	 * Constructs the header flags by combining various DNS header fields:
	 * - QR (Query/Response)
	 * - Opcode
	 * - AA (Authoritative Answer)
	 * - TC (Truncation)
	 * - RD (Recursion Desired)
	 * - RA (Recursion Available)
	 * - Z (Reserved)
	 * - RCODE (Response Code)
	 *
	 * @param {DNSHeaderType} data - The DNS header data to write
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
	 * Converts the internal header buffer to a Node.js Buffer
	 *
	 * The header is written in network byte order (big-endian)
	 * as required by the DNS protocol specification.
	 *
	 * @returns {Buffer} A 12-byte buffer containing the DNS header
	 */
	public getHeaderBuffer(): Buffer {
		const buffer = Buffer.alloc(12);
		this.headerBuffer.forEach((value, index) => {
			buffer.writeUInt16BE(value, index * 2);
		});
		return buffer;
	}
}
