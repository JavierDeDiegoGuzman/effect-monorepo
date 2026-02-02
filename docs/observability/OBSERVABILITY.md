# Observability Setup - Effect RPC Monorepo

## Overview

This project uses a **minimalist observability approach** inspired by [lucas-barake/effect-monorepo](https://github.com/lucas-barake/effect-monorepo):

- ✅ **Traces only** (no metrics/logging infrastructure)
- ✅ **Lightweight setup** (Jaeger for local, Google Cloud Trace for production)
- ✅ **Auto-switching** (environment-based configuration)
- ✅ **Effect-first** (native `Effect.withSpan`, `Effect.log` patterns)

---

## Quick Start

### Local Development

```bash
# 1. Start Jaeger
docker compose up -d

# 2. Run your app (default: development mode)
bun run dev

# 3. View traces in Jaeger UI
open http://localhost:16686

# 4. (Optional) View telemetry logs in terminal
docker compose logs -f otel-collector
```

**See detailed logging guide:** `DEV-LOGS.md`

### Production (Google Cloud Run)

```bash
# 1. Set environment variables
export GCP_PROJECT_ID=your-project-id
export NODE_ENV=production
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# 2. Run your app (automatically uses Google Cloud Trace)
bun run start

# 3. View traces in GCP
# https://console.cloud.google.com/traces
```

---

## Architecture

### Local Development
```
Effect RPC App (Bun/Browser)
  ↓ OTLP HTTP (localhost:4318)
Jaeger (All-in-One)
  ↓
Jaeger UI (localhost:16686)
```

### Production (Cloud Run)
```
Effect RPC App (Cloud Run)
  ↓ OTLP HTTP (localhost:4318)
OpenTelemetry Collector (Sidecar)
  ↓ Google Cloud Trace API
Google Cloud Trace Console
```

---

## File Structure

```
effect-monorepo/
├── packages/
│   ├── server/src/
│   │   ├── telemetry.ts         # ← Jaeger config (development)
│   │   ├── telemetry-gcp.ts     # ← Google Cloud Trace (production)
│   │   └── index.ts             # ← Auto-switches based on NODE_ENV
│   └── app/src/
│       ├── telemetry.ts         # ← Jaeger config (development)
│       ├── telemetry-gcp.ts     # ← Google Cloud Trace (production)
│       └── atoms.ts             # ← Auto-switches based on import.meta.env.MODE
├── otel-collector-config.yaml       # ← Jaeger collector config
├── otel-collector-config-gcp.yaml   # ← GCP collector config
└── docker-compose.yml               # ← Local Jaeger setup
```

---

## Environment Variables

### Development (Local)
```bash
# No configuration needed - uses Jaeger by default
NODE_ENV=development  # or unset
```

### Production (Google Cloud Run)
```bash
# Required
GCP_PROJECT_ID=your-project-id
NODE_ENV=production
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Optional (auto-detected by Cloud Run)
CLOUD_REGION=us-central1
K_SERVICE=effect-rpc-server
K_REVISION=effect-rpc-server-00042-xiv
```

---

## Usage Examples

### Creating Spans

```typescript
import { Effect } from "effect"

const myHandler = Effect.gen(function* () {
  // Your logic here
  const user = yield* createUser(name, email)
  
  yield* Effect.annotateCurrentSpan("user.id", user.id)
  yield* Effect.annotateCurrentSpan("user.email", user.email)
  
  return user
}).pipe(
  Effect.withSpan("UserHandler.create")  // ← Creates span
)
```

### Span Naming Convention

Follow the pattern: `ServiceName.methodName`

```typescript
// Database layer
Effect.withSpan("UsersRepository.create")
Effect.withSpan("UsersRepository.findById")

// Business logic layer
Effect.withSpan("UsersService.createUser")
Effect.withSpan("UsersService.login")

// RPC layer
Effect.withSpan("RPC.CreateUser")
Effect.withSpan("RPC.GetUsers")
```

### Logging (Correlated with Traces)

```typescript
import { Effect } from "effect"

const myHandler = Effect.gen(function* () {
  // Logs automatically include trace context
  yield* Effect.log("Creating user", { name, email })
  
  const user = yield* createUser(name, email)
  
  yield* Effect.log("User created successfully", { userId: user.id })
  
  return user
}).pipe(
  Effect.withSpan("UserHandler.create")
)
```

---

## Google Cloud Setup

### 1. Create Service Account

```bash
gcloud iam service-accounts create effect-rpc-telemetry \
  --display-name="Effect RPC Telemetry"
```

### 2. Grant Permissions

```bash
export PROJECT_ID=your-project-id

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:effect-rpc-telemetry@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudtrace.agent"
```

### 3. Attach to Cloud Run

```bash
gcloud run services update effect-rpc-server \
  --service-account=effect-rpc-telemetry@${PROJECT_ID}.iam.gserviceaccount.com \
  --region=us-central1
```

---

## Cost Estimation (Google Cloud Trace)

| Traffic Level | Spans/Month | Monthly Cost |
|---------------|-------------|--------------|
| **Low** (10 req/sec) | 13M spans | **FREE** (within free tier) |
| **Medium** (100 req/sec) | 130M spans | **$25/month** |
| **High** (1000 req/sec) | 1.3B spans | **$250/month** |

**Free Tier:** First 2.5M spans/month are FREE  
**Pricing:** $0.20 per million spans after free tier

### Cost Optimization

Enable sampling in production to reduce costs:

```yaml
# In otel-collector-config-gcp.yaml
processors:
  probabilistic_sampler:
    sampling_percentage: 10  # Sample 10% → 90% cost reduction
```

---

## Troubleshooting

### Traces not appearing in Jaeger (Local)

```bash
# 1. Check if Jaeger is running
docker ps | grep jaeger

# 2. Check if app is sending traces
curl -v http://localhost:4318/v1/traces

# 3. Check collector logs
docker compose logs otel-collector
```

### Traces not appearing in Google Cloud Trace

```bash
# 1. Check environment variables
echo $GCP_PROJECT_ID
echo $NODE_ENV

# 2. Check service account permissions
gcloud projects get-iam-policy ${PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:effect-rpc-telemetry@*"

# 3. View collector logs (Cloud Run)
gcloud run services logs read effect-rpc-server --limit=50
```

---

## Comparison with Alternatives

| Approach | Setup Complexity | Resource Usage | Cost | Best For |
|----------|------------------|----------------|------|----------|
| **Jaeger (current)** | Low | ~200MB RAM | FREE | Local development |
| **SigNoz** | Medium | ~1-2GB RAM | FREE | Full observability (traces + logs + metrics) |
| **Grafana Stack** | High | ~800MB-1.5GB | FREE | Production-ready, industry standard |
| **Google Cloud Trace** | Low | 0 (cloud) | ~$25/mo | Cloud Run deployments |
| **Datadog APM** | Low | 0 (cloud) | ~$465/mo | Enterprise observability |

---

## Further Reading

- **AGENTS.md** - Complete development guide with detailed observability setup
- **lucas-barake/effect-monorepo** - Reference implementation: https://github.com/lucas-barake/effect-monorepo
- **Effect OpenTelemetry Docs** - https://effect.website/docs/observability/opentelemetry
- **Google Cloud Trace Docs** - https://cloud.google.com/trace/docs

---

## Summary

✅ **Local:** Jaeger (simple, fast, free)  
✅ **Production:** Google Cloud Trace (managed, scalable, $0-25/mo)  
✅ **Zero Code Changes:** Auto-switches based on environment  
✅ **Minimalist:** Traces only, no heavy infrastructure  
✅ **Production-Ready:** Used by real Effect TypeScript projects  

Questions? Check **AGENTS.md** for detailed setup and troubleshooting.
