import type { QuestionType } from "../../types/questions";

export const parseDNSQuestion = (buffer: Buffer): QuestionType => {
	const question: QuestionType = {
		name: "",
		type: 0,
		class: 0,
	};

	const labels: string[] = [];
	let offset = 0;

	while (offset < buffer.length - 4) {
		// If we encounter the encoded Null Character, Break out from the Loop
		const labelLength = buffer.readUInt8(offset);
		if (labelLength === 0) {
			break;
		}

		const label = buffer.subarray(offset + 1, offset + labelLength + 1);
		labels.push(label.toString("utf-8"));
		offset += labelLength + 1;
	}

	question.name = labels.join(".");
	question.type = buffer.readUint16BE(offset);
	question.class = buffer.readUint16BE(offset + 2);
	return question;
};
