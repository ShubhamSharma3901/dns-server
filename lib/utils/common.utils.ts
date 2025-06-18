/**
 * DNS Compression Utilities + Common Used Utilities
 *
 * These functions implement DNS message compression according to RFC 1035,
 * with fixes for common compression pointer issues.
 */

import { DNSAnswer } from "../../classes/answers.class";
import { DNSHeader } from "../../classes/headers.class";
import { DNSQuestion } from "../../classes/questions.class";
import type { DNSAnswerType } from "../../types/answers";
import type { DNSHeaderType } from "../../types/headers";
import type { QuestionType } from "../../types/questions";
import { extractAnswerSection } from "./answers.utils";
import { parseDNSHeader } from "./headers.utils";
import { parseDNSQuestion } from "./questions.utils";
import * as dgram from "dgram";
import redisClient from "../redis/client.redis";
// Constants for DNS compression
const POINTER_MASK = 0b1100_0000; // 1100 0000 in binary - indicates compression pointer

/**
 * Checks if a byte represents a DNS compression pointer
 * @param byte - The byte to check
 * @returns {boolean} True if the byte is a compression pointer
 */
const isPointer = (byte: number): boolean => {
	return (byte & POINTER_MASK) === POINTER_MASK;
};

/**
 * Extracts the offset value from a compression pointer
 * @param byte - The first byte of the pointer
 * @param buffer - The buffer containing the pointer
 * @param offset - The offset of the second byte
 * @returns {number} The extracted pointer offset
 */
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

/**
 * Estimates the length of a domain name when uncompressed
 * @param domain - The domain name to measure
 * @returns {number} The estimated length in bytes
 */
export function estimateUncompressedNameLength(domain: string): number {
	return domain.split(".").reduce((acc, label) => acc + label.length + 1, 1); // +1 for length byte per label, and final 0
}

/**
 * Parses a complete DNS message
 * @param data - The buffer containing the DNS message
 * @returns {Object} Object containing parsed header and questions
 * @returns {DNSHeaderType} parsedHeader - The parsed DNS header
 * @returns {QuestionType[]} parsedQuestions - Array of parsed questions
 */
export function parseDNS(data: Buffer): {
	parsedHeader: DNSHeaderType;
	parsedQuestions: QuestionType[];
} {
	// ───── Parse Header ─────
	const parsedHeader: DNSHeaderType = parseDNSHeader(data);
	let offset = 12; // DNS header is 12 bytes
	const parsedQuestions: QuestionType[] = [];

	// ───── Parse All Questions ─────
	for (let i = 0; i < parsedHeader.qdcount; i++) {
		// Use the enhanced parsing function with compression support
		const {
			name,
			type,
			class: qClass,
			bytesUsed,
		} = parseDNSQuestion(data, offset);
		parsedQuestions.push({ name, type, class: qClass });
		offset += bytesUsed;
	}

	return { parsedHeader, parsedQuestions };
}

/**
 * Merges multiple DNS responses into a single response
 * @param transactionID - The transaction ID to use in the response
 * @param parsedHeader - The original query header
 * @param questions - Array of questions from the original query
 * @param responses - Array of response buffers from the resolver
 * @returns {Buffer} The merged response buffer
 */
export function mergeResponses(
	transactionID: Buffer,
	parsedHeader: DNSHeaderType,
	questions: QuestionType[],
	responses: Buffer[]
) {
	// ───── Step 1: Construct the Response Message with Compression ─────
	// Create a compression context (nameMap) for the response message
	const nameMap = new Map<string, number>();

	// ───── Step 2: Construct Header for Response ─────
	const responseHeader = new DNSHeader();
	responseHeader.writeHeader({
		...parsedHeader,
		pid: transactionID.readUInt16BE(0),
		qr: 1, // Response
		// rcode: 4, // No error
		qdcount: questions.length,
		ancount: responses.length,
		// nscount: 0,
		// arcount: 0,
	});
	const headerBuffer = responseHeader.getHeaderBuffer();

	// Start of the message, position after header
	let currentPosition = headerBuffer.length;

	// ───── Step 3: Encode Questions with Compression ─────
	const questionBuffers = questions.map((q) => {
		const question = new DNSQuestion();
		// Pass the nameMap and current position to enable compression
		const bytesWritten = question.writeQuestion(q, nameMap, currentPosition);
		const qBuffer = question.getQuestionBuffer();
		currentPosition += bytesWritten;
		return qBuffer;
	});

	// ───── Step 4: Retrieve Answer Buffers from Response sent by Resolver ─────
	const answers: Buffer[] = responses.map((r) => extractAnswerSection(r));

	// ───── Step 5: Send the Compressed Response ─────
	const response = Buffer.concat([
		headerBuffer,
		...questionBuffers,
		...answers,
	]);

	return response;
}

/**
 * Forwards a DNS query to an upstream resolver
 * @param packet - The DNS query packet to forward
 * @param host - The resolver host address
 * @param port - The resolver port
 * @returns {Promise<Buffer>} The resolver's response
 * @throws {Error} If the query times out or fails
 */
export function forwardQuery(
	packet: Buffer,
	host: string,
	port: number
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const client = dgram.createSocket("udp4");
		client.send(packet, port, host, (err) => {
			if (err) return reject(err);
		});

		let resolved = false;

		client.on("message", (resp) => {
			if (!resolved) {
				resolved = true;
				client.close();
				resolve(resp);
			}
		});

		setTimeout(() => {
			if (!resolved) {
				resolved = true;
				try {
					client.close();
				} catch (_) {}
				throw new Error("Timeout");
			}
		}, 2000);
	});
}
export function cacheResponse(
	key: string,
	response: DNSAnswerType,
	expirationTime: number
): Promise<void> {
	return new Promise((resolve, reject) => {
		redisClient.set(
			key,
			JSON.stringify(response),
			"EX",
			expirationTime,
			(err) => {
				if (err) {
					console.error("Error caching response:", err);
					reject(err);
				} else {
					resolve();
				}
			}
		);
	});
}

export function getCachedResponse(key: string): Promise<Buffer | null> {
	return new Promise((resolve, reject) => {
		redisClient.get(key, (err, result) => {
			if (err) {
				console.error("Error retrieving cached response:", err);
				reject(err);
			} else if (result) {
				resolve(Buffer.from(result));
			} else {
				resolve(null);
			}
		});
	});
}

export async function resolveWithCache(
	q: Buffer,
	resolverHostIP: string,
	resolverPort: number
): Promise<Buffer> {
	const questionName = q.subarray(12, q.length - 4);
	const questionType = q.readUInt16BE(q.length - 4);
	const cacheKey = `${questionName.toString("utf-8")}: ${questionType}`;
	// console.log("cacheKey: ", cacheKey, ": ", questionType);
	// Check if the response is cached
	const cachedResponse = await redisClient.get(cacheKey);

	if (cachedResponse) {
		console.log("Cache hit for key:", cacheKey);
		const bufferResponse = Buffer.from(cachedResponse, "base64");
		console.log("Cached Response: ", bufferResponse);
		return new Promise((resolve, reject) => {
			resolve(bufferResponse);
		});
	}
	// If not cached, forward the query to the resolver
	// and cache the response

	const response = await forwardQuery(q, resolverHostIP, resolverPort);

	await redisClient.set(cacheKey, response.toString("base64"), "EX", 60 * 60); // Cache for 1 hour
	console.log("Cache miss for key:", cacheKey);
	console.log("Response: ", response);

	return new Promise((resolve, reject) => {
		resolve(response);
	});
}
