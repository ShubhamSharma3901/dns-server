export const encodeDomainName = (name: string): Buffer => {
	const labels = name.split(".");
	const bytes: number[] = [];

	// Question Name: <Length><Content>....<NULL>
	for (const label of labels) {
		bytes.push(label.length); // Length byte
		for (const char of label) {
			bytes.push(char.charCodeAt(0)); // Label content
		}
	}

	bytes.push(0); // Null byte to terminate the name

	return Buffer.from(bytes);
};
