import type { QuestionType } from "../../types/questions";

export const encodeQuestionName = (name: string): Buffer => {
	const labels = name.split(".");
	const bytes: number[] = [];

	for (const label of labels) {
		bytes.push(label.length); // Length byte
		for (const char of label) {
			bytes.push(char.charCodeAt(0)); // Label content
		}
	}

	bytes.push(0); // Null byte to terminate the name
	console.log(bytes);
	return Buffer.from(bytes);
};
