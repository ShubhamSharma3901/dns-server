import { buffer } from "stream/consumers";
import { encodeDomainName } from "../lib/utils/common.utils";
import type { DNSAnswerType } from "../types/answers";
export class DNSAnswer {
	private answerBuffer: Buffer = Buffer.alloc(0);

	constructor() {}

	/**
	 * Writes the DNS answer with the provided Buffer Data.
	 * @param {DNSAnswerType}
	 * @returns {void}
	 */
	public writeAnswer(data: DNSAnswerType): void {
		const name = encodeDomainName(data.name);
		const type = data.type;
		const classType = data.class;
		const ttl = data.ttl;
		const rdlength = data.length;
		const rdata = Buffer.from(
			data.data
				.split(".")
				.map((IPByte) => {
					const bytes: number[] = [];
					for (const byte of IPByte) {
						bytes.push(parseInt(byte));
					}
					return bytes;
				})
				.flat()
		);

		const nameLength = name.length;
		this.answerBuffer = Buffer.alloc(nameLength + 2 + 2 + 4 + 2 + 4);
		name.copy(this.answerBuffer, 0);
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
