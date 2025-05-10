// questions.utils.ts - with compression support

import { parseDomainNameFromBuffer } from "./common.utils";
import type { QuestionType } from "../../types/questions";

/**
 * Parses a DNS Question section from a buffer with compression support
 * @param {Buffer} buffer - The buffer containing the question
 * @param {Buffer} originalBuffer - Original message buffer for compression references
 * @returns An object with parsed question and bytes used
 */
export function parseDNSQuestion(
	buffer: Buffer,
	originalBuffer: Buffer = buffer
): {
	name: string;
	type: number;
	class: number;
	bytesUsed: number;
} {
	// Parse the domain name with compression support
	const { parsedName, offset } = parseDomainNameFromBuffer(
		buffer,
		0,
		originalBuffer
	);

	// Read question type (2 bytes)
	const type = buffer.readUInt16BE(offset);

	// Read question class (2 bytes)
	const qClass = buffer.readUInt16BE(offset + 2);

	// Total bytes used = domain name + 2 bytes type + 2 bytes class
	return {
		name: parsedName,
		type,
		class: qClass,
		bytesUsed: offset + 4,
	};
}
