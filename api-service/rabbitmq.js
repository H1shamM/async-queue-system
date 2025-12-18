const amqp = require("amqplib")
let channel;
let connection;

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


async function connectRabbitMQ() {
    connection =  await connectRabbitMQWithRetry()
    channel = await connection.createChannel();

    await channel.assertQueue("jobs", {
        durable: true,
        arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "jobs.dlq"
        }
    });
    await channel.assertQueue("jobs.dlq", { durable: true });

    console.log("Queue 'jobs' asserted");


    console.log("Connected to RabbitMQ");

}

function getChannel() {
    if (!channel) {
        throw new Error("RabbitMQ channel not initialized");

    }
    return channel
}

async function closeRabbitMQ() {
    if (channel) await channel.close();
    if (connection) await connection.close();
}

module.exports = {
    connectRabbitMQ,
    getChannel,
    closeRabbitMQ
}