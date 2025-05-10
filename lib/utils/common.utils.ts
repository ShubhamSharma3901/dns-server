/**
 * DNS Compression Utilities
 *
 * These functions implement DNS message compression according to RFC 1035,
 * with fixes for common compression pointer issues.
 */

// Constants for DNS compression
const POINTER_MASK = 0b1100_0000; // 1100 0000 in binary - indicates compression pointer

const isPointer = (byte: number): boolean => {
	return (byte & POINTER_MASK) === POINTER_MASK;
};

const extractPointer = (
	byte: number,
	buffer: Buffer,
	offset: number
): number => {
	return ((byte & ~POINTER_MASK) << 8) | buffer.readUInt8(offset);
};
/**
 * Encodes a domain name with compression support
 * @param name The domain name to encode
 * @param nameMap map of already encoded names for compression
 * @returns Buffer containing the encoded domain name
 */
export const encodeDomainName = (
	name: string,
	nameMap: Map<string, number>,
	currentOffset: number
): { buffer: Buffer; newOffset: number } => {
	const labels: string[] = name.split(".");
	const bytes: number[] = [];
	let currentPosition: number = currentOffset;

	// Store the starting position of this domain name
	const startPosition: number = currentPosition;

	let i = 0;
	while (i < labels.length) {
		// Check if we can use compression for the remaining part of the name
		const remainingName = labels.slice(i).join(".");

		if (
			nameMap.has(remainingName) &&
			nameMap.get(remainingName) !== startPosition
		) {
			// Use a compression pointer, but never point to ourselves
			const pointer = nameMap.get(remainingName)!;

			// Pointers must be at least 12 bytes into the message to be valid
			// (after the DNS header) and must not point to the current position
			if (pointer >= 12 && pointer < startPosition) {
				bytes.push(POINTER_MASK | ((pointer >> 8) & 0x3f)); // High byte with compression bits
				bytes.push(pointer & 0xff); // Low byte
				return {
					buffer: Buffer.from(bytes),
					newOffset: currentPosition + 2, // pointer is 2 bytes
				};
			}
		}

		// No valid compression point found, encode this label normally
		const label = labels[i];

		// Store this position in the map for future compression
		if (!nameMap.has(remainingName)) {
			nameMap.set(remainingName, currentPosition);
		}

		// Add this label's length byte
		bytes.push(label.length);
		currentPosition++;

		// Add each character in the label
		for (const char of label) {
			bytes.push(char.charCodeAt(0));
			currentPosition++;
		}

		i++;
	}

	// Null byte to terminate the name
	bytes.push(0);
	currentPosition++;
	return {
		buffer: Buffer.from(bytes),
		newOffset: currentPosition,
	};
};

/**
 * Parses a domain name from a buffer with compression support
 * @param buffer The buffer containing the domain name
 * @param startOffset starting offset in the buffer
 * @returns The parsed domain name and the new offset
 */
export const parseDomainNameFromBuffer = (
	buffer: Buffer,
	startOffset: number
): { parsedName: string; offset: number } => {
	const labels: string[] = [];
	let offset = startOffset;
	let jumps = 0;
	const MAX_JUMPS = 10; // Protection against infinite loops from circular references

	while (offset < buffer.length) {
		// Read the label length/pointer byte
		const labelByte = buffer.readUInt8(offset);

		// Check if this is a pointer (compression)
		if (isPointer(labelByte)) {
			if (jumps >= MAX_JUMPS) {
				throw new Error(
					"Too many compression jumps, possible circular reference"
				);
			}

			// This is a pointer - extract the offset
			if (offset + 1 >= buffer.length) {
				throw new Error("Invalid compression pointer");
			}

			// Extract the 14-bit pointer value
			const pointerOffset = extractPointer(labelByte, buffer, offset + 1);

			// Validate pointer offset - must be at least 12 bytes into the message
			if (pointerOffset < 12 || pointerOffset >= buffer.length) {
				throw new Error(`Invalid compression pointer offset: ${pointerOffset}`);
			}

			// If this is the first pointer jump, remember the next position
			const nextOffset = offset + 2;

			// Jump to the new location in the original buffer
			offset = pointerOffset;
			jumps++;

			// Continue parsing from the new location using Recursion
			const result = parseDomainNameFromBuffer(buffer, pointerOffset);

			// Add the parsed name from the jump target
			if (result.parsedName) {
				labels.push(...result.parsedName.split("."));
			}

			// Return with the offset after the pointer
			return { parsedName: labels.join("."), offset: nextOffset };
		}

		// If we reach a zero length, we're at the end of the name
		if (labelByte === 0) {
			offset++;
			break;
		}

		// Regular label - read the characters
		offset++;
		// console.log("Label Byte: ", labelByte);
		// console.log("Offset: ", offset);
		console.log(
			"Buffer at offset:",
			offset,
			buffer.subarray(offset, offset + 10).toString("hex")
		);
		if (offset + labelByte > buffer.length) {
			throw new Error("Label extends beyond buffer");
		}

		const label = buffer.subarray(offset, offset + labelByte).toString("utf-8");
		labels.push(label);
		offset += labelByte;
	}

	return { parsedName: labels.join("."), offset };
};

export function estimateUncompressedNameLength(domain: string): number {
	return domain.split(".").reduce((acc, label) => acc + label.length + 1, 1); // +1 for length byte per label, and final Null Byte
}
