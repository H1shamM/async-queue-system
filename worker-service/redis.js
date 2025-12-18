const Redis = require("ioredis");

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT,
    keepAlive: 30000,
});

redis.on('connect', () => {
    console.log("connected to Redis")
});

redis.on('error', () => {
    console.error("redis error: ", error)
})

module.exports = redis;