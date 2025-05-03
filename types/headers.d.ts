enum RCODE {
	NOERROR = 0,
	FORMERR = 1,
	SERVFAIL = 2,
	NXDOMAIN = 3,
	NOTIMP = 4,
	REFUSED = 5,
}
enum OPCODE {
	QUERY = 0,
	IQUERY = 1,
	STATUS = 2,
}
export type DNSHeaderType = {
	pid: number;
	qr: number;
	opcode: OPCODE;
	aa: number;
	tc: number;
	rd: number;
	ra: number;
	z: number;
	rcode: RCODE;
	qdcount: number;
	ancount: number;
	nscount: number;
	arcount: number;
};
