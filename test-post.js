const http = require('http');

const data = JSON.stringify({
    id: "test_" + Date.now(),
    title: "Debug Topic",
    answers: [["A"]]
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/topics',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(`Status: ${res.statusCode}\nBody: ${body}`));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
