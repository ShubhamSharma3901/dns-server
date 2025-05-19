/**
 * DNS Question Utilities
 *
 * Functions for parsing and building DNS question sections with compression support
 */

import { encodeDomainName, parseDomainNameFromBuffer } from "./common.utils";
import type { QuestionType } from "../../types/questions";
import type { DNSHeaderType } from "../../types/headers";

/**
 * Parses a DNS Question section from a buffer with compression support
 * @param buffer - The buffer containing the question
 * @param startOffset - Starting offset in the buffer
 * @returns {Object} Object containing parsed question details and bytes used
 * @returns {string} name - The parsed domain name
 * @returns {number} type - The question type
 * @returns {number} class - The question class
 * @returns {number} bytesUsed - Number of bytes consumed by the question
 */
export function parseDNSQuestion(
	buffer: Buffer,
	startOffset: number
): {
	name: string;
	type: number;
	class: number;
	bytesUsed: number;
} {
	// Parse the domain name with compression support
	const { parsedName, offset } = parseDomainNameFromBuffer(buffer, startOffset);

	// Read question type (2 bytes)
	const type = buffer.readUInt16BE(offset);

	// Read question class (2 bytes)
	const qClass = buffer.readUInt16BE(offset + 2);

	// Total bytes used from the startOffset
	return {
		name: parsedName,
		type,
		class: qClass,
		bytesUsed: offset + 4 - startOffset,
	};
}

/**
 * Builds a single-question DNS packet
 * @param header - The DNS header to use
 * @param question - The question to include in the packet
 * @returns {Buffer} The complete DNS packet buffer
 */
export function buildSingleQuestionPacket(
	header: DNSHeaderType,
	question: QuestionType
): Buffer {
	const packetId = header.pid;

	// Build header with qdcount = 1, ancount = nscount = arcount = 0
	const buffer = Buffer.alloc(512);
	buffer.writeUInt16BE(packetId, 0); // ID
	buffer.writeUInt16BE(0x0100, 2); // Flags (standard query)
	buffer.writeUInt16BE(1, 4); // QDCOUNT
	buffer.writeUInt16BE(0, 6); // ANCOUNT
	buffer.writeUInt16BE(0, 8); // NSCOUNT
	buffer.writeUInt16BE(0, 10); // ARCOUNT

	const { buffer: nameBuffer } = encodeDomainName(question.name, new Map(), 12);
	let offset = 12;
	nameBuffer.copy(new Uint8Array(buffer), offset);
	offset += nameBuffer.length;

	buffer.writeUInt16BE(question.type, offset);
	offset += 2;
	buffer.writeUInt16BE(question.class, offset);
	offset += 2;

	return buffer.subarray(0, offset); // Trim to actual size and then return the buffer
}
