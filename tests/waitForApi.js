const http = require("http")

function waitForApi(url, timeoutMs = 2000) {
    const start = Date.now()
    
    return new Promise((resolve, reject) => {
        const tryRequest = () => {
            http
                .get(`${url}/health`, res => {
                    let data = "";
                    res.on("data", chunk => data+= chunk)
                    res.on("end", () => {
                        try {
                            const body = JSON.parse(data)
                            if (body.rabbit === true){
                                return resolve();
                            }
                        } catch (_) {
                        }
                    })
                })
                .on("error", () => {
                    
                });
            if (Date.now() - start > timeoutMs) {
                        reject(new Error("API did not became ready"));
                        
                    } else {
                        setTimeout(tryRequest, 500);
                        
                    }
        };

        tryRequest();
    });
}

module.exports = waitForApi