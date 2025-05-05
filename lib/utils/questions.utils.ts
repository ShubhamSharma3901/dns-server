import type { QuestionType } from "../../types/questions";
import { parseDomainNameFromBuffer } from "./common.utils";

export const parseDNSQuestion = (
	buffer: Buffer
): QuestionType & { bytesUsed: number } => {
	const question: QuestionType = {
		name: "",
		type: 1,
		class: 1,
	};
	const parsedQuestionName = parseDomainNameFromBuffer(buffer);
	question.name = parsedQuestionName.parsedName;

	// const offset = parsedQuestionName.offset;
	// question.type = buffer.readUint16BE(offset);
	// question.class = buffer.readUint16BE(offset + 2);
	return {
		...question,
		bytesUsed: parsedQuestionName.offset + 4, // name + 2 bytes QTYPE + 2 bytes QCLASS
	};
};
