const request = require("supertest")
const waitForApi = require("./waitForApi")
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

    it("returns 400 if type or payload missing", async () => {
        const res = await request(API_URL)
            .post('/jobs')
            .send({ type: 'email' });

        expect(res.statusCode).toBe(400);
    })

});



