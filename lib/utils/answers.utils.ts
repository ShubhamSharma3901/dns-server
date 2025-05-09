import type { DNSAnswerType } from "../../types/answers";
import { parseDomainNameFromBuffer } from "./common.utils";

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
