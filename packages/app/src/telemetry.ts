import { Otlp } from "@effect/opentelemetry"
import { FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"

/**
 * OpenTelemetry configuration for the React client app.
 * 
 * Uses the lightweight Otlp implementation to send traces and metrics
 * from the browser to Jaeger via OTLP HTTP protocol.
 * 
 * Jaeger UI: http://localhost:16686
 * OTLP Endpoint: http://localhost:4318
 * 
 * Note: In production, you would configure CORS to allow browser
 * requests to your telemetry collector endpoint.
 */
export const TelemetryLive = Otlp.layerJson({
  // Jaeger OTLP HTTP endpoint
  baseUrl: "http://localhost:4318",
  
  // Service resource attributes (shows in Jaeger)
  resource: {
    serviceName: "effect-rpc-client",
    serviceVersion: "1.0.0",
    attributes: {
      "deployment.environment": "development",
      "service.type": "frontend",
      "runtime": "browser",
      "user.agent": typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
    }
  },
  
  // Export configuration - less aggressive than server
  tracerExportInterval: "5 seconds",    // Export traces every 5 seconds
  metricsExportInterval: "15 seconds",  // Export metrics every 15 seconds
  maxBatchSize: 50,                     // Smaller batch size for browser
  shutdownTimeout: "3 seconds",
  
  // Don't create spans for internal logs (reduces noise)
  loggerExcludeLogSpans: true
}).pipe(
  // Provide HTTP client for sending telemetry data (using browser Fetch API)
  Layer.provide(FetchHttpClient.layer)
)
