const request = require("supertest")
const waitForApi = require("./waitForApi")
const { server } = require('../api-service/index')
const { closeRabbitMQ } = require('../api-service/rabbitmq')
const redis = require('../api-service/redis')
const API_URL = 'http://api:3000'



beforeAll(async () => {
    await waitForApi(API_URL, timeoutMs = 60000);
}, 60000)

describe("Jobs inegration", () => {
    it("accepts a job and returns 202", async () => {
        const res = await request(API_URL)
            .post("/jobs")
            .send({
                type: "SEND_EMAIL",
                payload: { email: "test@example.com" }
            });

        expect(res.statusCode).toBe(202);
        expect(res.body.jobId).toBeDefined();
    });
});

afterAll(async () => {
    await closeRabbitMQ();
    await redis.flushAll();
    await redis.closeRedis();
    server.close();
})

