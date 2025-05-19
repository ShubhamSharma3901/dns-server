/**
 * DNS Server Implementation
 *
 * This module implements a DNS server that can forward queries to a resolver
 * and handle multiple questions in a single query.
 */
// External dependencies
import * as dgram from "dgram";

// Internal utilities
import { buildSingleQuestionPacket } from "../lib/utils/questions.utils";
import {
	forwardQuery,
	mergeResponses,
	parseDNS,
} from "../lib/utils/common.utils";

// Server configuration
const udpSocket = dgram.createSocket("udp4");
const PORT = Number(process.env.PORT) || 2053;
const HOST = process.env.HOST_NAME || "0.0.0.0";

function getResolverConfig(): { resolverHostIP: string; resolverPort: number } {
	// 1. Try --resolver <ip>:<port> from CLI args
	const resolverArgIndex = process.argv.indexOf("--resolver");
	let resolverValue: string | undefined;

	if (resolverArgIndex !== -1 && resolverArgIndex + 1 < process.argv.length) {
		resolverValue = process.argv[resolverArgIndex + 1];
	}

	// 2. If not provided in CLI, try ENV
	if (!resolverValue && process.env.RESOLVER) {
		resolverValue = process.env.RESOLVER;
	}

	// 3. If still undefined, throw
	if (!resolverValue) {
		throw new Error(
			"Resolver not provided. Use --resolver <ip>:<port> or set RESOLVER environment variable."
		);
	}

	// 4. Parse IP and port
	const [resolverHostIP, resolverPortStr] = resolverValue.split(":");
	const resolverPort = parseInt(resolverPortStr, 10);

	if (!resolverHostIP || isNaN(resolverPort)) {
		throw new Error(
			`Invalid resolver format: ${resolverValue}. Expected format: <ip>:<port>`
		);
	}

	return { resolverHostIP, resolverPort };
}
const { resolverHostIP, resolverPort } = getResolverConfig();
console.log(`Using resolver: ${resolverHostIP}:${resolverPort}`);
// Initialize UDP server
udpSocket.bind(PORT, HOST, () => {
	console.log(`DNS server running at ${HOST}:${PORT}`);
});

/**
 * Handle incoming DNS queries
 *
 * For each incoming query:
 * 1. Extract transaction ID and parse DNS packet
 * 2. Handle single or multiple questions
 * 3. Forward queries to resolver
 * 4. Merge responses and send back to client
 */
udpSocket.on("message", async (data: Buffer, remote: dgram.RemoteInfo) => {
	try {
		console.log(`\nReceived DNS query from ${remote.address}:${remote.port}`);
		const transactionID = data.subarray(0, 2);
		const { parsedHeader, parsedQuestions: questions } = parseDNS(data);

		console.log("Questions:", questions);
		console.log("Parsed Header:", parsedHeader);

		// Handle single or multiple questions in the query
		const queries =
			questions.length === 1
				? [data]
				: questions.map((q) => buildSingleQuestionPacket(parsedHeader, q));

		// Forward all queries to resolver and collect responses
		const responses = await Promise.all(
			queries.map((q) => forwardQuery(q, resolverHostIP, resolverPort))
		);

		// Merge responses and send back to client
		const mergedResponse = mergeResponses(
			transactionID,
			parsedHeader,
			questions,
			responses
		);
		//@ts-ignore
		udpSocket.send(mergedResponse, remote.port, remote.address);
	} catch (err) {
		console.error("Error processing DNS query:", err);
	}
});

// Handle server errors
udpSocket.on("error", (err) => {
	udpSocket.close();
	console.error(`Server error:\n${err.stack}`);
});
