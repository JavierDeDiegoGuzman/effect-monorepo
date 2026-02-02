import { Otlp } from "@effect/opentelemetry"
import { FetchHttpClient } from "@effect/platform"
import { Layer, Config, Effect } from "effect"

/**
 * OpenTelemetry configuration for Google Cloud Trace (Browser/Client).
 * 
 * This configuration is designed for React applications running in the browser
 * and includes:
 * - Browser-specific resource attributes
 * - Optimized export intervals for client-side
 * - Support for both local development and production
 * 
 * Architecture:
 * Browser App → OTLP HTTP → Backend Proxy/Collector → Google Cloud Trace
 * 
 * Note: In production, you typically don't send telemetry directly from the
 * browser to GCP. Instead, you proxy through your backend to:
 * - Avoid exposing GCP credentials
 * - Reduce browser bundle size
 * - Control sampling rates centrally
 * 
 * Environment Variables (Vite):
 * - VITE_OTEL_EXPORTER_OTLP_ENDPOINT: Collector endpoint
 * - VITE_APP_VERSION: Application version
 * - MODE: Vite environment mode (development/production)
 */

// Configuration from environment variables (Vite format)
const OTEL_EXPORTER_OTLP_ENDPOINT = Config.string("VITE_OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
  Config.withDefault("http://localhost:4318") // Local collector
)

const APP_VERSION = Config.string("VITE_APP_VERSION").pipe(
  Config.withDefault("1.0.0")
)

/**
 * Google Cloud Trace telemetry layer for browser.
 * 
 * This layer is lightweight and optimized for browser environments.
 * It uses lower export frequencies to reduce network overhead.
 */
export const TelemetryGcpLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const endpoint = yield* OTEL_EXPORTER_OTLP_ENDPOINT
    const version = yield* APP_VERSION
    
    // Get Vite mode (development/production)
    const mode = import.meta.env.MODE || "production"
    
    // Browser detection (safe for SSR)
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
    const platform = typeof navigator !== "undefined" ? navigator.platform : "unknown"
    const language = typeof navigator !== "undefined" ? navigator.language : "unknown"

    return Otlp.layerJson({
      // OTLP endpoint (backend proxy or collector)
      baseUrl: endpoint,
      
      // Browser-specific resource attributes
      resource: {
        serviceName: "effect-rpc-client",
        serviceVersion: version,
        attributes: {
          // Telemetry SDK info
          "telemetry.sdk.language": "webjs",
          "telemetry.sdk.name": "opentelemetry",
          
          // Service info
          "service.name": "effect-rpc-client",
          "service.namespace": "rpc",
          "deployment.environment": mode,
          
          // Browser info
          "browser.platform": platform,
          "browser.language": language,
          "browser.user_agent": userAgent,
          
          // Optional: User tracking (privacy-aware, use anonymized IDs)
          // "enduser.id": anonymousUserId,
          // "enduser.session": sessionId,
        }
      },
      
      // Browser-optimized export intervals
      // Less aggressive than server to reduce network usage
      tracerExportInterval: "10 seconds",   // Export traces every 10 seconds
      metricsExportInterval: "30 seconds",  // Export metrics every 30 seconds
      maxBatchSize: 100,                    // Smaller batch size for browser
      shutdownTimeout: "5 seconds",
      
      // Reduce noise in production
      loggerExcludeLogSpans: true
    }).pipe(
      // Provide HTTP client for sending telemetry data (browser Fetch API)
      Layer.provide(FetchHttpClient.layer)
    )
  })
)
