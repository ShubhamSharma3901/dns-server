import Redis from "ioredis";

const redisClient = new Redis({
	host: process.env.REDIS_HOST,
	port: Number(process.env.REDIS_PORT),
	password: process.env.REDIS_PASSWORD,
	username: process.env.REDIS_USERNAME,
});

redisClient.on("connect", () => {
	console.log(
		"Redis client connected at: " + process.env.REDIS_HOST,
		": ",
		process.env.REDIS_PORT
	);
});

redisClient.on("error", (err) => {
	console.error("Redis error: ", err);
});

export default redisClient;
