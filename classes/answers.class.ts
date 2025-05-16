/**
 * DNS Answer Class
 *
 * Implements a class for handling DNS answer sections according to RFC 1035.
 * Manages the construction of DNS answer records with support for domain name compression.
 * Each answer record contains:
 * - Domain name (with compression support)
 * - Type (16 bits)
 * - Class (16 bits)
 * - TTL (32 bits)
 * - RDLength (16 bits)
 * - RData (variable length)
 */

import { encodeDomainName } from "../lib/utils/common.utils";
import type { DNSAnswerType } from "../types/answers";

export class DNSAnswer {
	private answerBuffer: Buffer = Buffer.alloc(0);

	constructor() {}

	/**
	 * Writes the DNS answer with the provided Buffer Data.
	 * @param {DNSAnswerType} data - The answer data
	 * @param {Map<string, number>} nameMap - Optional map for domain name compression
	 * @param {number} currentOffset - Current position in the overall message for compression
	 * @returns {number} The new offset after writing the answer
	 */
	public writeAnswer(
		data: DNSAnswerType,
		nameMap: Map<string, number> = new Map(),
		currentOffset: number
	): number {
		const { buffer: name, newOffset } = encodeDomainName(
			data.name,
			nameMap,
			currentOffset
		);
		const type = data.type;
		const classType = data.class;
		const ttl = data.ttl;
		const rdlength = data.length;

		const rdata = Buffer.from(
			data.data.split(".").map((octet) => parseInt(octet))
		);

		this.answerBuffer = Buffer.alloc(name.length + 10 + rdlength);

		name.copy(this.answerBuffer, 0);
		this.answerBuffer.writeUInt16BE(type, name.length);
		this.answerBuffer.writeUInt16BE(classType, name.length + 2);
		this.answerBuffer.writeUInt32BE(ttl, name.length + 4);
		this.answerBuffer.writeUInt16BE(rdlength, name.length + 8);
		rdata.copy(this.answerBuffer, name.length + 10);

		if (name[0] >= 0xc0) {
			console.log(`[Compression] Pointer used for name '${data.name}'`);
		} else {
			console.log(`[No Compression] Name encoded fully for '${data.name}'`);
		}

		return this.answerBuffer.length;
	}

	/**
	 * Returns the answer buffer as a Buffer object.
	 * @returns {Buffer} The answer buffer.
	 */
	public getAnswerBuffer(): Buffer {
		return this.answerBuffer;
	}
}
