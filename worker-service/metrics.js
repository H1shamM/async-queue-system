const redis = require("./redis")

async function incr(metric) {
    await redis.incr(`metrics:${metric}`)
}

module.exports = {
    incr,
}