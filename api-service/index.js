const express = require('express')
const { RateLimiterMemory } = require("rate-limiter-flexible")
const { connectRabbitMQ, getChannel } = require('./rabbitmq')
const { v4: uuidv4 } = require("uuid");
const redis = require('./redis');
const metrics = require("./metrics")

let rabbit_is_ready = false

require("dotenv").config()
const app = express();
app.use(express.json())

const limiter = new RateLimiterMemory({
    points: 50,
    duration: 10
});


app.use(async (req, res, next) => {
    try {
        await limiter.consume(req.ip)
        next();
    } catch (err) {
        return res.status(429).json({ error: "Too many requests" });
    }

})

app.get("/", (req, res) => {
    res.send("Rate limiter working!")
});

app.post('/jobs', async (req, res) => {
    if (!rabbit_is_ready) {
        return res.status(503).json({ message: "Queue not ready" });
    }

    const { type, payload } = req.body

    if (!type || !payload) {
        return res.status(400).json({ error: "type and payloadare required" })
    }
    const job = {
        jobId: uuidv4(),
        type: type,
        payload: payload,
        createdAt: new Date().toISOString()
    };

    try {
        const channel = getChannel()
        await metrics.incr("jobs_created")
        await redis.set(`job:${job.jobId}`, "NEW")

        channel.sendToQueue(
            "jobs",
            Buffer.from(JSON.stringify(job)),
            { persistent: true }
        );

        return res.status(202).json({
            message: "Job accepted!",
            jobId: job.jobId,

        });


    } catch (error) {
        console.log("Failed to publish jobs", error);
        return res.status(500).json({ message: "Failed to enqueue jobs " });
    }

});

app.get("/jobs/:id", async (req, res) => {
    const jobId = req.params.id;

    const status = await redis.get(`job:${jobId}`)

    if (!status) {
        return res.status(404).json({ error: "Job not found" })
    }

    const result = await redis.get(`job:${jobId}:result`)
    const error = await redis.get(`job:${jobId}:error`)

    res.json({ 
        jobId, 
        status,
        result: result ? JSON.parse(result) : null,
        error: error || null
     })

});

app.get('/metrics', async (req, res) => {

    const keys = [
        "jobs_created",
        "jobs_processing",
        "jobs_success",
        "jobs_failed",
        "jobs_retried",
        "jobs_dlq",
    ]

    const values = await Promise.all(
        keys.map(k => redis.get(`metrics:${k}`))
    )
    const metrics = {}
    keys.forEach((k, i) => {
        metrics[k] = Number(values[i] || 0)
    })

    res.json(metrics)
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        rabbit: rabbit_is_ready,
    })
})

let server;

const startServer = async () => {
    try {
        await connectRabbitMQ()
        console.log("RabbitMQ connected")
        rabbit_is_ready = true

        const server = app.listen(3000, () => console.log("API service running on port 3000"));

        module.exports = { app, server };
    } catch (err) {
        console.error("Failed to start API: ", err)
        process.exit(1);
    }
}

const shutdown = async () => {
    console.log("API shutting down...");
    if (server) server.close(() => { console.log("API stopped") })
    await redis.quit()
    process.exit(0);

}
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

if (require.main === module) {
    startServer();
}



