import { MeterProvider } from '@opentelemetry/sdk-metrics-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, BatchSpanProcessor, ConsoleSpanExporter, } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation, ExpressRequestHookInformation } from 'opentelemetry-instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Span, Baggage } from '@opentelemetry/api';
import { AlwaysOnSampler, AlwaysOffSampler, ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/core';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { serviceSyncDetector } from 'opentelemetry-resource-detector-service';
import { CollectorTraceExporter, CollectorMetricExporter, } from '@opentelemetry/exporter-collector';
import WsInstrumentation from './ws-instrumentation/ws';
import CustomSampler from './custom-sampler';


const init = function (serviceName: string, metricPort: number) {

    // Define metrics
    // const metricExporter = new PrometheusExporter({ port: metricPort }, () => {
    //     console.log(`scrape: http://localhost:${metricPort}${PrometheusExporter.DEFAULT_OPTIONS.endpoint}`);
    // });

    const metricExporter = new CollectorMetricExporter({
        url: 'http://localhost:4318/v1/metrics'
    })
    const meter = new MeterProvider({ exporter: metricExporter, interval: 100000 }).getMeter(serviceName);

    // Define traces
    // const traceExporter = new JaegerExporter({ endpoint: 'http://localhost:14268/api/traces'});
    const serviceResources = serviceSyncDetector.detect();
    const customResources = new Resource({'my-resource':1});

    const provider = new NodeTracerProvider({
        resource: serviceResources.merge(customResources),
        sampler: new CustomSampler()

    });


   // Create a trace exporter to send collected spans to a collector
    const traceExporter = new CollectorTraceExporter({
        url: 'http://localhost:4318/v1/trace'
    })

    // provider.addSpanProcessor(new BatchSpanProcessor(traceExporter,)
        // scheduledDelayMillis:7000

    // Add span processors for exporting spans
    provider.addSpanProcessor(new SimpleSpanProcessor(traceExporter));
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

    // Register instrumentations for automatic tracing
    provider.register();
    registerInstrumentations({
        instrumentations: [
            new ExpressInstrumentation({
                requestHook: (span, reqInfo) => {
                    span.setAttribute('request-headers',JSON.stringify(reqInfo.req.headers))
                }
            }),
            new HttpInstrumentation(),
            new IORedisInstrumentation(),
             new WsInstrumentation()
        ]
    });
    // Get the tracer from the provider
    const tracer = provider.getTracer(serviceName);
    return { meter, tracer };
}

export default init;