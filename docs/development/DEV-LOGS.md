# Viewing Telemetry Logs in Development

## Quick Start

To see OpenTelemetry traces, logs, and metrics in your terminal during development:

```bash
# 1. Start the services
docker compose up -d

# 2. Follow the OpenTelemetry collector logs
docker compose logs -f otel-collector

# 3. In another terminal, run your app
bun run dev

# 4. Make requests and watch the logs appear in real-time
```

---

## What You'll See

### Traces
```
2026-02-02T10:25:16.435Z info Traces {
  "resourceSpans": [{
    "resource": {
      "attributes": [{
        "key": "service.name",
        "value": "effect-rpc-server"
      }]
    },
    "scopeSpans": [{
      "spans": [{
        "name": "RPC.GetUsers",
        "spanId": "abc123...",
        "traceId": "xyz789...",
        "startTimeUnixNano": "1675341916435000000",
        "endTimeUnixNano": "1675341916450000000",
        "attributes": [...]
      }]
    }]
  }]
}
```

### Logs (from Effect.log)
```
2026-02-02T10:25:16.435Z info Logs {
  "resourceLogs": [{
    "scopeLogs": [{
      "logRecords": [{
        "body": "User created successfully",
        "attributes": [{
          "key": "userId",
          "value": "12345"
        }],
        "traceId": "xyz789...",  # ← Correlated with trace!
        "spanId": "abc123..."
      }]
    }]
  }]
}
```

### Metrics
```
2026-02-02T10:25:16.435Z info Metrics {
  "resourceMetrics": [{
    "scopeMetrics": [{
      "metrics": [{
        "name": "rpc_duration_ms",
        "histogram": {
          "dataPoints": [...]
        }
      }]
    }]
  }]
}
```

---

## Configuration

The logging is configured in `otel-collector-config.yaml`:

```yaml
exporters:
  debug:
    verbosity: detailed      # Options: basic, normal, detailed
    sampling_initial: 5      # Log first 5 items
    sampling_thereafter: 200 # Then every 200th item

service:
  pipelines:
    traces:
      exporters: [otlp/jaeger, debug]  # Both Jaeger UI + console
    logs:
      exporters: [debug]  # Console only
    metrics:
      exporters: [debug]  # Console only
```

### Verbosity Levels

- **`basic`** - Only counts and basic info
- **`normal`** - Includes span names and attributes
- **`detailed`** - Full JSON output (default)

### Sampling

To reduce log volume, adjust sampling:

```yaml
exporters:
  debug:
    sampling_initial: 1      # Log only first item
    sampling_thereafter: 100 # Then every 100th
```

---

## Alternative: Effect.log Output

Your Effect application also logs to console using `Effect.log`. These logs are automatically sent to the collector AND printed to your terminal:

```typescript
// In your code
yield* Effect.log("User created", { userId: user.id })

// Terminal output:
[11:24:53.290] INFO: User created { userId: "12345" }
```

To control Effect log levels:

```typescript
// In packages/server/src/index.ts
import { Logger, LogLevel } from "effect"

const runtime = Runtime.make(
  Layer.mergeAll(
    // ... other layers
    Logger.minimumLogLevel(LogLevel.Debug)  // Show all logs
  )
)
```

**Log Levels:**
- `LogLevel.All` - Show everything
- `LogLevel.Debug` - Debug + info + warn + error
- `LogLevel.Info` - Info + warn + error (default development)
- `LogLevel.Warning` - Warn + error only
- `LogLevel.Error` - Errors only
- `LogLevel.None` - No logs

---

## Filtering Logs

### Show only traces:
```bash
docker compose logs -f otel-collector | grep "Traces"
```

### Show only your service:
```bash
docker compose logs -f otel-collector | grep "effect-rpc-server"
```

### Show only errors:
```bash
docker compose logs -f otel-collector | grep "ERROR"
```

---

## Troubleshooting

### No logs appearing

1. Check collector is running:
```bash
docker compose ps otel-collector
```

2. Check your app is sending telemetry:
```bash
curl -v http://localhost:4318/v1/traces
# Should return 200 OK
```

3. Check collector configuration:
```bash
docker compose logs otel-collector | grep "Starting"
# Should show "Everything is ready"
```

### Too much output

Reduce verbosity in `otel-collector-config.yaml`:

```yaml
exporters:
  debug:
    verbosity: basic  # Less verbose
    sampling_initial: 1
    sampling_thereafter: 500  # Log very infrequently
```

Or disable the debug exporter entirely:

```yaml
service:
  pipelines:
    traces:
      exporters: [otlp/jaeger]  # Remove 'debug'
```

---

## Production Note

⚠️ The `debug` exporter is **only for development**. In production:
- It's automatically disabled (GCP config doesn't include it)
- Logs go to Google Cloud Trace instead
- No performance impact from console logging

---

## Example Session

```bash
# Terminal 1: Watch collector logs
$ docker compose logs -f otel-collector

# Terminal 2: Run server
$ cd packages/server && bun src/index.ts
[11:24:53.290] INFO: Server starting on port 3000

# Terminal 3: Run client
$ cd packages/app && bun run dev

# Terminal 4: Make requests
$ curl -X POST http://localhost:3000/rpc/users \
    -H "Content-Type: application/json" \
    -d '{"request":{"_tag":"GetUsers"}}'

# Back to Terminal 1: See the traces!
2026-02-02T10:25:16.435Z info Traces {
  "resourceSpans": [...]
}
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `docker compose logs -f otel-collector` | Follow all telemetry logs |
| `docker compose logs otel-collector --tail=50` | Last 50 log lines |
| `docker compose restart otel-collector` | Restart after config change |
| `docker compose down && docker compose up -d` | Full restart |

---

For more information, see:
- `OBSERVABILITY.md` - Complete observability guide
- `otel-collector-config.yaml` - Collector configuration
- `AGENTS.md` - Development guide
