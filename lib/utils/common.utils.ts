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

export const parseDomainNameFromBuffer = (
	buffer: Buffer
): { parsedName: string; offset: number } => {
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

	return { parsedName: labels.join("."), offset: offset };
};
