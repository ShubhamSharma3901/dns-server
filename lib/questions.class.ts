import type { QuestionType } from "../types/questions";
import { encodeQuestionName } from "./utils/questions.utils";

export class DNSQuestion {
	private questionBuffer: Buffer = Buffer.alloc(0);

	constructor() {}

	public writeQuestion(question: QuestionType): void {
		const encodedName = encodeQuestionName(question.name);
		console.log("encodedName: ", encodedName);

		// Allocate buffer: encodedName length + 2 bytes for type + 2 for class
		this.questionBuffer = Buffer.alloc(encodedName.length + 4);

		// The buffer is allocated with the size of the encoded name plus 4 bytes (2 for type and 2 for class).
		encodedName.copy(this.questionBuffer, 0);

		// Write type (2 bytes)
		this.questionBuffer.writeUInt16BE(question.type, encodedName.length);

		// Write class (2 bytes)
		this.questionBuffer.writeUInt16BE(question.class, encodedName.length + 2);
	}
	public getQuestionBuffer(): Buffer {
		return this.questionBuffer;
	}
}
