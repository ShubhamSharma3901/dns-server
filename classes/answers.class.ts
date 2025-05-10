import { encodeDomainName } from "../lib/utils/common.utils";
import type { DNSAnswerType } from "../types/answers";

export class DNSAnswer {
	private answerBuffer: Buffer = Buffer.alloc(0);

	constructor() {}

	/**
	 * Writes the DNS answer with the provided Buffer Data.
	 * @param {DNSAnswerType} data - The answer data
	 * @param {Map<string, number>} nameMap - Optional map for domain name compression
	 * @param {number} offset - Current position in the overall message for compression
	 * @returns {void}
	 */
	public writeAnswer(
		data: DNSAnswerType,
		nameMap: Map<string, number> = new Map(),
		offset: number = 0
	): void {
		// Use the enhanced encodeDomainName function with compression support
		const name = encodeDomainName(data.name, nameMap);
		const type = data.type;
		const classType = data.class;
		const ttl = data.ttl;
		const rdlength = data.length;

		// Parse IP address into bytes
		const rdata = Buffer.from(
			data.data.split(".").map((octet) => parseInt(octet))
		);

		const nameLength = name.length;
		this.answerBuffer = Buffer.alloc(nameLength + 10 + rdlength);

		// Copy the compressed domain name
		name.copy(this.answerBuffer, 0);

		// Write the rest of the answer record
		this.answerBuffer.writeUInt16BE(type, nameLength);
		this.answerBuffer.writeUInt16BE(classType, nameLength + 2);
		this.answerBuffer.writeUInt32BE(ttl, nameLength + 4);
		this.answerBuffer.writeUInt16BE(rdlength, nameLength + 8);
		rdata.copy(this.answerBuffer, nameLength + 10);
	}

	/**
	 * Returns the answer buffer as a Buffer object.
	 * @returns {Buffer} The answer buffer.
	 */
	public getAnswerBuffer(): Buffer {
		return this.answerBuffer;
	}
}
