const amqp = require("amqplib")
const redis = require("./redis")
const metrics = require("./metrics")


const QUEUE_NAME = "jobs"
const MAX_RETRIES = 3
let shuttingDown = false

function getRetryDelay(retryCount) {
    const base = 2000
    return base * Math.pow(2, retryCount);
}

async function assertRetryQueue(channel, retryCount) {
    const delay = getRetryDelay(retryCount)

    const queueName = `retry_queue_${retryCount}`

    channel.assertQueue(queueName, {
        durable: true,
        arguments: {
            'x-message-ttl': delay,
            'x-dead-letter-exchange': "",
            'x-dead-letter-routing-key': QUEUE_NAME
        }
    })

    return queueName;
}

async function connectRabbitMQWithRetry(reties = 3) {
    while (reties > 0) {
        try {
            const connection = await amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost")
            console.log("Connected to RabbitMQ");
            return connection;
        } catch (err) {
            console.log("RabbitMQ not ready, retring...")
            reties--;
            await new Promise(r => setTimeout(r, 3000))
        }
    }
    throw new Error("Could not connect to RabbitMQ");
}

async function startWorker() {

    const connection = await connectRabbitMQWithRetry()
    const channel = await connection.createChannel()


    await channel.prefetch(1);
    await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "jobs.dlq"
        }
    });
    await channel.assertQueue("jobs.dlq", { durable: true });

    console.log("Worker waiting for jobs ...")

    channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;

        const job = JSON.parse(msg.content.toString())
        const headers = msg.properties.headers || {};
        const retryCount = headers["x-retry-count"] || 0;
        const jobKey = `job:${job.jobId}`

        const status = await redis.get(jobKey)

        if (status == "SUCCESS") {
            console.log(`Skipping duplicate job ${job.jobId}`)
            channel.ack(msg)
            return;
        }

        if (shuttingDown) {
            channel.nack(msg, false, true)
            return;
        }

        try {

            console.log(`Processing job:${job.jobId} retry ${retryCount}`);
            await redis.set(`job:${job.jobId}`, "PROCESSING")
            await processJob(job)
            console.log("job succeeeded!")
            await redis.set(jobKey, "SUCCESS", "EX", 3600);
            await metrics.incr("jobs_success")

            channel.ack(msg)
        } catch (error) {
            if (retryCount >= MAX_RETRIES) {
                console.log("Job sent DLQ");
                channel.nack(msg, false, false)
                await redis.set(`job:${job.jobId}`, "FAILED")
                await metrics.incr("jobs_failed")
                await metrics.incr("jobs_dlq")

            }
            else {
                const nextRetry = retryCount + 1
                const retryQueue = await assertRetryQueue(channel, nextRetry)
                await metrics.incr("jobs_retried")
                channel.publish(
                    "",
                    retryQueue,
                    msg.content,
                    {
                        headers: {
                            'x-retry-count': nextRetry
                        }
                    }
                );
                channel.ack(msg)
            }
        }
    });
};

async function processJob(job) {
    if (Math.random() < 0.5) {
        throw new Error("Random faluire");

    }
    await metrics.incr("jobs_processing")
    await new Promise((resolve) => setTimeout(resolve, 1000))
}

async function shutdown() {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log("Graceful shutdown started...")

    setTimeout(async () => {
        console.log("Closing connections...")
        
        await redis.quit()
        process.exit(0)
    }, 5000);
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)


startWorker().catch(console.error);