# OpenTelemetry Integration

This monorepo includes full OpenTelemetry integration for distributed tracing and metrics.

## Quick Start

1. **Start Jaeger** (telemetry backend):
   ```bash
   docker compose up -d
   ```

2. **Start the development servers**:
   ```bash
   bun run dev
   ```

3. **Open Jaeger UI**: http://localhost:16686

4. **Use the app**: http://localhost:5173
   - Create some users
   - Watch the user list update

5. **View traces in Jaeger**:
   - Select service: `effect-rpc-server` or `effect-rpc-client`
   - Click "Find Traces"
   - Explore the distributed traces!

## What You'll See

### Traces
- **Client → Server flow**: See how requests travel from browser to backend
- **RPC operations**: Each RPC call creates a span with timing info
- **User operations**: Creating users shows detailed spans with metadata

### Metrics
- `rpc_calls_total` - Total RPC calls
- `user_operations_total` - User CRUD operations
- `rpc_duration_ms` - RPC call duration
- `event_broadcasts_total` - Event broadcasts
- `active_subscribers` - Active SSE subscribers

## Architecture

```
┌─────────────────────────────────────────┐
│         Jaeger UI (:16686)              │
│    View traces, metrics, dependencies   │
└─────────────────────────────────────────┘
                    ↑
                    │ OTLP HTTP (:4318)
                    │
┌───────────────────┴─────────────────────┐
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │   Server     │◄───┤   Client     │  │
│  │   (Bun)      │───►│  (Browser)   │  │
│  │              │ RPC│              │  │
│  │ TelemetryLive│    │TelemetryLive │  │
│  └──────────────┘    └──────────────┘  │
│                                         │
│    Both send traces to Jaeger           │
└─────────────────────────────────────────┘
```

## File Structure

- `docker-compose.yml` - Jaeger container configuration
- `packages/server/src/telemetry.ts` - Server telemetry setup
- `packages/app/src/telemetry.ts` - Client telemetry setup
- `packages/server/src/handlers.ts` - Instrumented RPC handlers

## Adding Custom Instrumentation

### Create a span:
```typescript
import { Effect } from "effect"

const myOperation = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan("user.id", userId)
  yield* Effect.annotateCurrentSpan("operation", "custom")
  
  // Your logic
  
}).pipe(Effect.withSpan("my-operation"))
```

### Add a metric:
```typescript
import { Metric } from "effect"

const myCounter = Metric.counter("my_custom_counter")

const operation = Effect.gen(function* () {
  yield* Metric.increment(myCounter)
  // Your logic
})
```

## Production Setup

To use in production:

1. **Update telemetry URLs** in `packages/*/src/telemetry.ts`:
   ```typescript
   baseUrl: process.env.OTLP_ENDPOINT || "http://localhost:4318"
   ```

2. **Add authentication** if required:
   ```typescript
   headers: {
     "Authorization": `Bearer ${process.env.OTLP_API_KEY}`
   }
   ```

3. **Adjust export intervals** based on your needs
4. **Configure CORS** for browser telemetry endpoints

## Troubleshooting

### No traces appearing in Jaeger?
- Check Jaeger is running: `docker ps | grep jaeger`
- Verify OTLP endpoint: `curl http://localhost:4318/v1/traces` (should return 405)
- Check browser console for CORS errors

### Server not starting?
- Port 3000 may be in use: `lsof -ti:3000 | xargs kill -9`
- Check logs: `bun packages/server/src/index.ts`

### Stopping Jaeger:
```bash
docker compose down
```

## Learn More

- [Effect OpenTelemetry Docs](https://effect-ts.github.io/effect/docs/opentelemetry)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Protocol](https://opentelemetry.io/docs/specs/otlp/)
