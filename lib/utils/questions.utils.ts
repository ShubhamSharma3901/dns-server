import { parseDomainNameFromBuffer } from "./common.utils";

/**
 * Parses a DNS Question section from a buffer with compression support
 * @param {Buffer} buffer - The buffer containing the question
 * @param {number} startOffset - The starting offset in the buffer
 * @returns {Object} An object containing the parsed question name, type, class, and bytes used
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
