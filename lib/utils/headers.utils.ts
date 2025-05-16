/**
 * DNS Header Utilities
 *
 * Functions for parsing DNS message headers according to RFC 1035.
 * Provides both complete and selective parsing of DNS headers.
 */

import type { DNSHeaderType } from "../../types/headers";

/**
 * Parses a complete DNS header from a buffer
 *
 * Extracts all header fields from the 12-byte DNS header:
 * - ID (16 bits)
 * - Flags (16 bits):
 *   - QR (1 bit)
 *   - Opcode (4 bits)
 *   - AA (1 bit)
 *   - TC (1 bit)
 *   - RD (1 bit)
 *   - RA (1 bit)
 *   - Z (3 bits)
 *   - RCODE (4 bits)
 * - QDCOUNT (16 bits)
 * - ANCOUNT (16 bits)
 * - NSCOUNT (16 bits)
 * - ARCOUNT (16 bits)
 *
 * @param buffer - The buffer containing the DNS header
 * @returns {DNSHeaderType} The parsed header data
 */
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

/**
 * Parses a DNS header with selective field values for response generation
 *
 * This function is used when constructing DNS responses, where certain fields
 * need to be set to specific values regardless of the original query:
 * - Sets QR to 1 (Response)
 * - Sets AA, TC, RA, and Z to 0
 * - Sets RCODE based on opcode
 * - Sets QDCOUNT and ANCOUNT to 1
 * - Sets NSCOUNT and ARCOUNT to 0
 *
 * @param buffer - The buffer containing the original DNS header
 * @returns {DNSHeaderType} The modified header data for response
 */
export const parseDNSHeaderSelective = (buffer: Buffer): DNSHeaderType => {
	const pid = buffer.readUInt16BE(0);
	const qr = 1;
	const opcode = (buffer.readUInt16BE(2) >> 11) & 0b00001111;
	const aa = 0;
	const tc = 0;
	const rd = (buffer.readUInt16BE(2) >> 8) & 0x1;
	const ra = 0;
	const z = 0;
	const rcode = opcode === 0 ? 0 : 4;
	const qdcount = 1;
	const ancount = 1;
	const nscount = 0;
	const arcount = 0;

	const parsedHeaderData: DNSHeaderType = {
		pid,
		qr,
		opcode,
		aa,
		tc,
		rd,
		ra,
		z,
		rcode,
		qdcount,
		ancount,
		nscount,
		arcount,
	};

	return parsedHeaderData;
};
