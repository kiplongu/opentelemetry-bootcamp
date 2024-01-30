import init from './tracer';
const { tracer } = init('users-services', 8091);

import * as api from '@opentelemetry/api';
import axios from 'axios';
import * as express from 'express';
const app = express();
const randomNumber = (min: number, max: number) => Math.floor(Math.random() * max + min);

import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8092 });

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        try{
        const payload = JSON.parse(message?.toString());
        const propagatedContext = api.propagation.extract(api.ROOT_CONTEXT, payload);
        const wsSpan = tracer.startSpan('got ws message', {
            attributes: {
                'payload': message?.toString()
            }});
        // }}, propagatedContext)
        console.log('received: %s', message);
        wsSpan.end();
    } catch(e){
        console.error(e)
    }
    });
});

import * as Redis from 'ioredis';
const redis = new Redis();


app.get('/user', async (request, response) => {
    const apiResponse = await axios('https://mocki.io/v1/d4867d8b-b5d5-4a48-a4ab-79131b5809b8');
    const randomIndex = randomNumber(0, apiResponse.data.length)
    const activeSpan = api.trace.getSpan(api.context.active());
    activeSpan.addEvent('A number was randomizaed', {
        randomIndex
    })

    response.json(apiResponse.data[randomIndex]);
})

app.listen(8090);
console.log('users services is up and running on port 8090');

redis.subscribe('my-channel', (err, data) => {
    console.log(`on subscribe`);

    // Event handler for incoming messages on the subscribed channel
    redis.on("message", (channel, message) => {
        // Parse the JSON message received from the channel
        const payload = JSON.parse(message);

        // Extract the propagated context using OpenTelemetry
        const propagatedContext = api.propagation.extract(api.ROOT_CONTEXT, payload);

        // Start a new span to represent the consumption of the message
        const span = api.trace.getTracer('@opentelemetry/instrumentation-ioredis').startSpan("consume a message", {
            attributes: {
                message,
            }
        }, propagatedContext);

        // End the span to indicate the completion of the operation
        span.end();

        // Log the received message and channel
        console.log(`Received ${message} from ${channel}`);
    });
});


// Set up a periodic task to refresh cache every 6 seconds
setInterval(async () => {
    // Retrieve the 'manual' tracer from the OpenTelemetry tracing API
    api.trace.getTracer('manual').startActiveSpan('Refresh cache', async (span) => {
        // Perform an asynchronous HTTP request to a mock API endpoint
        const apiResponse = await axios('https://mocki.io/v1/d4867d8b-b5d5-4a48-a4ab-79131b5809b8');
        span.end();
    });
}, 6000);
