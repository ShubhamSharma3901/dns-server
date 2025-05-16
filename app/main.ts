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
const HOST = process.env.HOST_NAME || "127.0.0.1";

// Parse resolver configuration from command line arguments
const resolverArgIndex = process.argv.indexOf("--resolver");
if (resolverArgIndex === -1 || resolverArgIndex + 1 >= process.argv.length) {
	throw new Error("Usage: ./your_server --resolver <ip>:<port>");
}
const [resolverHostIP, resolverPortStr] =
	process.argv[resolverArgIndex + 1].split(":");

const resolverPort = parseInt(resolverPortStr, 10);

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
