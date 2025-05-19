// app/main.ts
import * as dgram2 from "dgram";

// classes/headers.class.ts
class DNSHeader {
  headerBuffer = new Uint16Array(6);
  static instance = new DNSHeader;
  constructor() {}
  static getInstance() {
    if (!this.instance) {
      this.instance = new DNSHeader;
    }
    return this.instance;
  }
  writeHeader(data) {
    const flags = data.qr << 15 | data.opcode << 11 | data.aa << 10 | data.tc << 9 | data.rd << 8 | data.ra << 7 | data.z << 4 | data.rcode;
    this.headerBuffer.set([
      data.pid,
      flags,
      data.qdcount,
      data.ancount,
      data.nscount,
      data.arcount
    ]);
  }
  getHeaderBuffer() {
    const buffer = Buffer.alloc(12);
    this.headerBuffer.forEach((value, index) => {
      buffer.writeUInt16BE(value, index * 2);
    });
    return buffer;
  }
}

// classes/questions.class.ts
class DNSQuestion {
  questionBuffer = Buffer.alloc(0);
  constructor() {}
  writeQuestion(question, nameMap = new Map, currentPosition = 12) {
    const { buffer: encodedName, newOffset } = encodeDomainName(question.name, nameMap, currentPosition);
    this.questionBuffer = Buffer.alloc(encodedName.length + 4);
    encodedName.copy(this.questionBuffer, 0);
    this.questionBuffer.writeUInt16BE(question.type, encodedName.length);
    this.questionBuffer.writeUInt16BE(question.class, encodedName.length + 2);
    return this.questionBuffer.length;
  }
  getQuestionBuffer() {
    return this.questionBuffer;
  }
}

// lib/utils/headers.utils.ts
var parseDNSHeader = (buffer) => {
  const parsedHeaderData = {
    pid: buffer.readUInt16BE(0),
    qr: buffer.readUInt16BE(2) >> 15 & 1,
    opcode: buffer.readUInt16BE(2) >> 11 & 15,
    aa: buffer.readUInt16BE(2) >> 10 & 1,
    tc: buffer.readUInt16BE(2) >> 9 & 1,
    rd: buffer.readUInt16BE(2) >> 8 & 1,
    ra: buffer.readUInt16BE(2) >> 7 & 1,
    z: buffer.readUInt16BE(2) >> 4 & 7,
    rcode: buffer.readUInt16BE(2) & 15,
    qdcount: buffer.readUInt16BE(4),
    ancount: buffer.readUInt16BE(6),
    nscount: buffer.readUInt16BE(8),
    arcount: buffer.readUInt16BE(10)
  };
  return parsedHeaderData;
};

// lib/utils/answers.utils.ts
function extractAnswerSection(buffer) {
  const header = parseDNSHeader(buffer);
  let offset = 12;
  for (let i = 0;i < header.qdcount; i++) {
    const { bytesUsed } = parseDNSQuestion(buffer, offset);
    offset += bytesUsed;
  }
  const answerStart = offset;
  for (let i = 0;i < header.ancount; i++) {
    const { parsedName: name, offset: newOffset } = parseDomainNameFromBuffer(buffer, offset);
    const type = buffer.readUInt16BE(newOffset);
    const classType = buffer.readUInt16BE(newOffset + 2);
    const ttl = buffer.readUInt32BE(newOffset + 4);
    const rdlength = buffer.readUInt16BE(newOffset + 8);
    const answerLength = newOffset - offset + 10 + rdlength;
    offset += answerLength;
  }
  const answerEnd = offset;
  console.log(`[extractExactAnswerSection] Answer bytes: ${answerEnd - answerStart}`);
  return buffer.subarray(answerStart, answerEnd);
}

// lib/utils/common.utils.ts
import * as dgram from "dgram";
var POINTER_MASK = 192;
var isPointer = (byte) => {
  return (byte & POINTER_MASK) === POINTER_MASK;
};
var extractPointer = (byte, buffer, offset) => {
  return (byte & ~POINTER_MASK) << 8 | buffer.readUInt8(offset);
};
var encodeDomainName = (name, nameMap, currentOffset) => {
  const labels = name.split(".");
  const bytes = [];
  let currentPosition = currentOffset;
  const startPosition = currentPosition;
  let i = 0;
  while (i < labels.length) {
    const remainingName = labels.slice(i).join(".");
    if (nameMap.has(remainingName) && nameMap.get(remainingName) !== startPosition) {
      const pointer = nameMap.get(remainingName);
      if (pointer >= 12 && pointer < startPosition) {
        bytes.push(POINTER_MASK | pointer >> 8 & 63);
        bytes.push(pointer & 255);
        return {
          buffer: Buffer.from(bytes),
          newOffset: currentPosition + 2
        };
      }
    }
    const label = labels[i];
    if (!nameMap.has(remainingName)) {
      nameMap.set(remainingName, currentPosition);
    }
    bytes.push(label.length);
    currentPosition++;
    for (const char of label) {
      bytes.push(char.charCodeAt(0));
      currentPosition++;
    }
    i++;
  }
  bytes.push(0);
  currentPosition++;
  return {
    buffer: Buffer.from(bytes),
    newOffset: currentPosition
  };
};
var parseDomainNameFromBuffer = (buffer, startOffset) => {
  const labels = [];
  let offset = startOffset;
  let jumps = 0;
  const MAX_JUMPS = 10;
  while (offset < buffer.length) {
    const labelByte = buffer.readUInt8(offset);
    if (isPointer(labelByte)) {
      if (jumps >= MAX_JUMPS) {
        throw new Error("Too many compression jumps, possible circular reference");
      }
      if (offset + 1 >= buffer.length) {
        throw new Error("Invalid compression pointer");
      }
      const pointerOffset = extractPointer(labelByte, buffer, offset + 1);
      if (pointerOffset < 12 || pointerOffset >= buffer.length) {
        throw new Error(`Invalid compression pointer offset: ${pointerOffset}`);
      }
      const nextOffset = offset + 2;
      offset = pointerOffset;
      jumps++;
      const result = parseDomainNameFromBuffer(buffer, pointerOffset);
      if (result.parsedName) {
        labels.push(...result.parsedName.split("."));
      }
      return { parsedName: labels.join("."), offset: nextOffset };
    }
    if (labelByte === 0) {
      offset++;
      break;
    }
    offset++;
    console.log("Buffer at offset:", offset, buffer.subarray(offset, offset + 10).toString("hex"));
    if (offset + labelByte > buffer.length) {
      throw new Error("Label extends beyond buffer");
    }
    const label = buffer.subarray(offset, offset + labelByte).toString("utf-8");
    labels.push(label);
    offset += labelByte;
  }
  return { parsedName: labels.join("."), offset };
};
function parseDNS(data) {
  const parsedHeader = parseDNSHeader(data);
  let offset = 12;
  const parsedQuestions = [];
  for (let i = 0;i < parsedHeader.qdcount; i++) {
    const {
      name,
      type,
      class: qClass,
      bytesUsed
    } = parseDNSQuestion(data, offset);
    parsedQuestions.push({ name, type, class: qClass });
    offset += bytesUsed;
  }
  return { parsedHeader, parsedQuestions };
}
function mergeResponses(transactionID, parsedHeader, questions, responses) {
  const nameMap = new Map;
  const responseHeader = DNSHeader.getInstance();
  responseHeader.writeHeader({
    ...parsedHeader,
    pid: transactionID.readUInt16BE(0),
    qdcount: questions.length,
    ancount: responses.length
  });
  const headerBuffer = responseHeader.getHeaderBuffer();
  let currentPosition = headerBuffer.length;
  const questionBuffers = questions.map((q) => {
    const question = new DNSQuestion;
    const bytesWritten = question.writeQuestion(q, nameMap, currentPosition);
    const qBuffer = question.getQuestionBuffer();
    currentPosition += bytesWritten;
    return qBuffer;
  });
  const answers = responses.map((r) => extractAnswerSection(r));
  const response = Buffer.concat([
    headerBuffer,
    ...questionBuffers,
    ...answers
  ]);
  return response;
}
function forwardQuery(packet, host, port) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    client.send(packet, port, host, (err) => {
      if (err)
        return reject(err);
    });
    let resolved = false;
    client.on("message", (resp) => {
      if (!resolved) {
        resolved = true;
        client.close();
        resolve(resp);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          client.close();
        } catch (_) {}
        throw new Error("Timeout");
      }
    }, 2000);
  });
}

// lib/utils/questions.utils.ts
function parseDNSQuestion(buffer, startOffset) {
  const { parsedName, offset } = parseDomainNameFromBuffer(buffer, startOffset);
  const type = buffer.readUInt16BE(offset);
  const qClass = buffer.readUInt16BE(offset + 2);
  return {
    name: parsedName,
    type,
    class: qClass,
    bytesUsed: offset + 4 - startOffset
  };
}
function buildSingleQuestionPacket(header, question) {
  const packetId = header.pid;
  const buffer = Buffer.alloc(512);
  buffer.writeUInt16BE(packetId, 0);
  buffer.writeUInt16BE(256, 2);
  buffer.writeUInt16BE(1, 4);
  buffer.writeUInt16BE(0, 6);
  buffer.writeUInt16BE(0, 8);
  buffer.writeUInt16BE(0, 10);
  const { buffer: nameBuffer } = encodeDomainName(question.name, new Map, 12);
  let offset = 12;
  nameBuffer.copy(new Uint8Array(buffer), offset);
  offset += nameBuffer.length;
  buffer.writeUInt16BE(question.type, offset);
  offset += 2;
  buffer.writeUInt16BE(question.class, offset);
  offset += 2;
  return buffer.subarray(0, offset);
}

// app/main.ts
var udpSocket = dgram2.createSocket("udp4");
var PORT = Number(process.env.PORT) || 2053;
var HOST = process.env.HOST_NAME || "0.0.0.0";
function getResolverConfig() {
  const resolverArgIndex = process.argv.indexOf("--resolver");
  let resolverValue;
  if (resolverArgIndex !== -1 && resolverArgIndex + 1 < process.argv.length) {
    resolverValue = process.argv[resolverArgIndex + 1];
  }
  if (!resolverValue && process.env.RESOLVER) {
    resolverValue = process.env.RESOLVER;
  }
  if (!resolverValue) {
    throw new Error("Resolver not provided. Use --resolver <ip>:<port> or set RESOLVER environment variable.");
  }
  const [resolverHostIP, resolverPortStr] = resolverValue.split(":");
  const resolverPort = parseInt(resolverPortStr, 10);
  if (!resolverHostIP || isNaN(resolverPort)) {
    throw new Error(`Invalid resolver format: ${resolverValue}. Expected format: <ip>:<port>`);
  }
  return { resolverHostIP, resolverPort };
}
var { resolverHostIP, resolverPort } = getResolverConfig();
console.log(`Using resolver: ${resolverHostIP}:${resolverPort}`);
udpSocket.bind(PORT, HOST, () => {
  console.log(`DNS server running at ${HOST}:${PORT}`);
});
udpSocket.on("message", async (data, remote) => {
  try {
    console.log(`
Received DNS query from ${remote.address}:${remote.port}`);
    const transactionID = data.subarray(0, 2);
    const { parsedHeader, parsedQuestions: questions } = parseDNS(data);
    console.log("Questions:", questions);
    console.log("Parsed Header:", parsedHeader);
    const queries = questions.length === 1 ? [data] : questions.map((q) => buildSingleQuestionPacket(parsedHeader, q));
    const responses = await Promise.all(queries.map((q) => forwardQuery(q, resolverHostIP, resolverPort)));
    const mergedResponse = mergeResponses(transactionID, parsedHeader, questions, responses);
    udpSocket.send(mergedResponse, remote.port, remote.address);
  } catch (err) {
    console.error("Error processing DNS query:", err);
  }
});
udpSocket.on("error", (err) => {
  udpSocket.close();
  console.error(`Server error:
${err.stack}`);
});
