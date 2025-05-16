/**
 * DNS Answer Utilities
 *
 * Functions for parsing and handling DNS answer sections
 */

import type { DNSAnswerType } from "../../types/answers";
import { parseDomainNameFromBuffer } from "./common.utils";
import { parseDNSHeader } from "./headers.utils";
import { parseDNSQuestion } from "./questions.utils";

/**
 * Parses a DNS answer section from a buffer
 * @param buffer - The buffer containing the answer
 * @param offset - Starting offset in the buffer
 * @param name - Optional pre-parsed name for the answer
 * @returns {DNSAnswerType} The parsed answer object
 */
export const parseDNSAnswer = (
	buffer: Buffer,
	offset: number,
	name?: string
): DNSAnswerType => {
	const answer: DNSAnswerType = {
		name: name || "",
		type: 1,
		class: 1,
		ttl: 60,
		length: 4,
		data: "8.8.8.8",
	};
	// answer.name = parseDomainNameFromBuffer(buffer).parsedName;
	// answer.type = buffer.readUint16BE(offset);
	// answer.class = buffer.readUint16BE(offset + 2);
	// answer.ttl = buffer.readUInt32BE(offset + 4);
	// answer.length = buffer.readUInt16BE(offset + 8);
	/**
	 * For answer.data => It can vary based on the type of answer
	 * To parse the data, we need to check the type of answer
	 * For example, if the type is A, we need to parse the data as an IP address
	 * If the type is CNAME, we need to parse the data as a domain name
	 * If the type is MX, we need to parse the data as a mail exchange
	 * If the type is NS, we need to parse the data as a name server
	 * If the type is TXT, we need to parse the data as a text record
	 * If the type is AAAA, we need to parse the data as an IPv6 address
	 * To do this, in future, we can create a function that takes the type of answer as an input and then in that function we can parse the answer data based on the type provided (possibly using a switch case)
	 * For now, we will just convert the data to a string (A record)
	 */
	return answer;
};

/**
 * Extracts the answer section from a complete DNS message
 * @param buffer - The complete DNS message buffer
 * @returns {Buffer} The answer section buffer
 */
export function extractAnswerSection(buffer: Buffer): Buffer {
	const header = parseDNSHeader(buffer);
	let offset = 12;

	// Skip all questions
	for (let i = 0; i < header.qdcount; i++) {
		const { bytesUsed } = parseDNSQuestion(buffer, offset);
		offset += bytesUsed;
	}

	const answerStart = offset;

	// Now parse each answer to determine total byte length of all answers
	for (let i = 0; i < header.ancount; i++) {
		const { parsedName: name, offset: newOffset } = parseDomainNameFromBuffer(
			buffer,
			offset
		);
		const type = buffer.readUInt16BE(newOffset);
		const classType = buffer.readUInt16BE(newOffset + 2);
		const ttl = buffer.readUInt32BE(newOffset + 4);
		const rdlength = buffer.readUInt16BE(newOffset + 8);

		/**
		 * Total bytes used by this answer:
		 *	newOffset - offset = length of NAME (which may be compressed)
		 *	+10 = TYPE + CLASS + TTL + RDLENGTH
		 *	+rdlength = length of the data
		 */
		const answerLength = newOffset - offset + 10 + rdlength;
		offset += answerLength;
	}

	const answerEnd = offset;

	console.log(
		`[extractExactAnswerSection] Answer bytes: ${answerEnd - answerStart}`
	);
	return buffer.subarray(answerStart, answerEnd);
}
