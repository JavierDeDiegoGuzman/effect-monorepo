import { Otlp } from "@effect/opentelemetry"
import { FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"

/**
 * OpenTelemetry configuration for the Effect RPC server.
 * 
 * Uses the lightweight Otlp implementation to send traces and metrics
 * to Jaeger via OTLP HTTP protocol.
 * 
 * Jaeger UI: http://localhost:16686
 * OTLP Endpoint: http://localhost:4318
 */
export const TelemetryLive = Otlp.layerJson({
  // Jaeger OTLP HTTP endpoint
  baseUrl: "http://localhost:4318",
  
  // Service resource attributes (shows in Jaeger)
  resource: {
    serviceName: "effect-rpc-server",
    serviceVersion: "1.0.0",
    attributes: {
      "deployment.environment": "development",
      "service.type": "backend",
      "runtime": "bun"
    }
  },
  
  // Export configuration
  tracerExportInterval: "3 seconds",   // Export traces every 3 seconds
  metricsExportInterval: "10 seconds", // Export metrics every 10 seconds
  maxBatchSize: 100,                   // Batch size before forcing export
  shutdownTimeout: "5 seconds",        // Timeout on shutdown
  
  // Don't create spans for internal logs (reduces noise)
  loggerExcludeLogSpans: true
}).pipe(
  // Provide HTTP client for sending telemetry data
  Layer.provide(FetchHttpClient.layer)
)
