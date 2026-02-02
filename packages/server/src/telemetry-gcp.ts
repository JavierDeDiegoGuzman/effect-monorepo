import { Otlp } from "@effect/opentelemetry"
import { FetchHttpClient } from "@effect/platform"
import { Layer, Config, Effect } from "effect"

/**
 * OpenTelemetry configuration for Google Cloud Trace (Production).
 * 
 * This configuration is designed for Cloud Run deployments and includes:
 * - Auto-detection of Cloud Run environment variables
 * - Resource attributes for GCP integration
 * - Optimized export intervals for production
 * 
 * Architecture:
 * Effect RPC App → OTLP HTTP → OTel Collector Sidecar → Google Cloud Trace
 * 
 * Environment Variables Required:
 * - GCP_PROJECT_ID: Your Google Cloud project ID
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Collector endpoint (default: http://localhost:4318)
 * - NODE_ENV: Environment (development/staging/production)
 * 
 * Cloud Run Auto-Detected Variables:
 * - K_SERVICE: Cloud Run service name
 * - K_REVISION: Cloud Run revision
 * - K_CONFIGURATION: Cloud Run configuration
 * - CLOUD_REGION: GCP region (e.g., us-central1)
 */

// Configuration from environment variables
const GCP_PROJECT_ID = Config.string("GCP_PROJECT_ID").pipe(
  Config.withDefault("local-project")
)

const OTEL_EXPORTER_OTLP_ENDPOINT = Config.string("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
  Config.withDefault("http://localhost:4318") // Collector sidecar on Cloud Run
)

const NODE_ENV = Config.string("NODE_ENV").pipe(
  Config.withDefault("production")
)

const CLOUD_REGION = Config.string("CLOUD_REGION").pipe(
  Config.withDefault("us-central1")
)

/**
 * Google Cloud Trace telemetry layer.
 * 
 * This layer dynamically configures telemetry based on environment variables,
 * making it suitable for both local testing (with Docker Compose) and
 * production deployment on Cloud Run.
 */
export const TelemetryGcpLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const projectId = yield* GCP_PROJECT_ID
    const endpoint = yield* OTEL_EXPORTER_OTLP_ENDPOINT
    const environment = yield* NODE_ENV
    const region = yield* CLOUD_REGION

    // Cloud Run environment variables (auto-detected)
    const serviceName = process.env.K_SERVICE || "effect-rpc-server"
    const revision = process.env.K_REVISION || "local"
    const instanceId = process.env.K_INSTANCE_ID || "local"

    return Otlp.layerJson({
      // OTLP endpoint (collector sidecar or direct to GCP)
      baseUrl: endpoint,
      
      // GCP-specific resource attributes
      // These help Google Cloud Trace properly identify and group your telemetry
      resource: {
        serviceName: serviceName,
        serviceVersion: revision,
        attributes: {
          // GCP resource detection
          "cloud.provider": "gcp",
          "cloud.platform": "gcp_cloud_run",
          "cloud.region": region,
          "cloud.account.id": projectId,
          
          // Service identification
          "service.name": serviceName,
          "service.namespace": "rpc",
          "service.instance.id": instanceId,
          
          // Deployment info
          "deployment.environment": environment,
          "deployment.version": revision,
          
          // Runtime info
          "runtime": "bun",
          "runtime.version": typeof Bun !== "undefined" ? Bun.version : "unknown",
          
          // Cloud Run specific (FAAS = Function as a Service)
          "faas.name": serviceName,
          "faas.version": revision,
          "faas.instance": instanceId,
        }
      },
      
      // Production-tuned export intervals
      tracerExportInterval: "5 seconds",    // Faster exports for traces
      metricsExportInterval: "60 seconds",  // Less frequent for metrics
      maxBatchSize: 512,                    // Larger batches for efficiency
      shutdownTimeout: "10 seconds",        // Graceful shutdown for Cloud Run
      
      // Reduce noise in production
      loggerExcludeLogSpans: true
    }).pipe(
      // Provide HTTP client for sending telemetry data
      Layer.provide(FetchHttpClient.layer)
    )
  })
)
