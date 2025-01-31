import init from './tracer';
const { meter, tracer } = init('items-service', 8081);

import * as api from '@opentelemetry/api';
import axios from 'axios';
import * as express from 'express';
import * as Redis from 'ioredis';
const redis = new Redis();

import * as WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8092');


const app = express();
const httpCounter = meter.createCounter('http_calls');

app.use((request, response, next) => {
    httpCounter.add(1);
    next();
});

// Define an Express route for handling WebSocket communication at the '/ws' endpoint
app.get('/ws', (req, res) => {
    const payload = { msg: 'Hi over ws' };
    // const wsSpan = tracer.startSpan('send ws message', {})
    // api.propagation.inject(api.trace.setSpan(api.context.active(), wsSpan), payload);
    // wsSpan.setAttribute('payload',JSON.stringify(payload))

    ws.send(JSON.stringify(payload));
    // wsSpan.end();
    res.json({ ws: true })
})

app.get('/data', async (request, response) => {
    try {
        if (request.query['fail']) {
            throw new Error('A really bad error :/')
        }
        const user = await axios.get('http://localhost:8090/user');
        response.json(user.data);
    } catch (e) {
        const activeSpan = api.trace.getSpan(api.context.active());
        console.error(`Critical error`, { traceId: activeSpan.spanContext().traceId });
        activeSpan.recordException(e);
        response.sendStatus(500);
    }
})

app.get('/pub', (request, response) => {
    // Retrieve the currently active span from the OpenTelemetry API
    const activeSpan = api.trace.getSpan(api.context.active());

    // Prepare a payload with a message
    let payload = {
        message: 'this-is-my-message'
    };

    // Inject the span context into the payload using propagation
    api.propagation.inject(api.trace.setSpan(api.context.active(), activeSpan), payload);

    // Publish the payload (converted to a JSON string) to a Redis channel named 'my-channel'
    redis.publish('my-channel', JSON.stringify(payload));

    // Send a 200 OK response
    response.sendStatus(200);
});


app.listen(8080);
console.log('items services is up and running on port 8080');


