# AGENTS.md - Development Guide for Agentic Coding

This guide is designed for AI agents working in this Effect RPC monorepo.

## Quick Reference

### Monorepo Structure
- **contract**: RPC schema definitions using Effect RPC (users + auth)
- **server**: Bun HTTP server with Effect Platform (ports: 3000)
- **app**: React frontend with effect-atom (ports: 5173)
- **cli**: Command-line testing tool for RPC endpoints

### Build & Run Commands

#### All Packages
```bash
bun run build          # TypeScript compile all packages
bun run check      # Type-check all packages
bun run dev            # Run server + app concurrently
```

#### Per Package
```bash
# Contract (schema definitions)
bun run --filter @effect-monorepo/contract build
bun run --filter @effect-monorepo/contract typecheck

# Server (HTTP + RPC backend)
bun run --filter @effect-monorepo/server dev       # Watch mode with hot reload
bun run --filter @effect-monorepo/server start     # Production run
bun run --filter @effect-monorepo/server build

# App (React frontend)
bun run --filter @effect-monorepo/app dev          # Vite dev server
bun run --filter @effect-monorepo/app build
bun run --filter @effect-monorepo/app typecheck

# CLI (testing tool)
bun packages/cli/src/index.ts list                 # List users
bun packages/cli/src/index.ts register "Name" "email@test.com" "password123"  # Register
bun packages/cli/src/index.ts login "email@test.com" "password123"  # Login
bun packages/cli/src/index.ts create "Name" "email" "<token>"  # Create user (needs auth token)
bun packages/cli/src/index.ts test-workflow       # Run full auth workflow test
bun packages/cli/src/index.ts --help              # Show help
```

#### Individual Testing/Running
- **Server**: `bun packages/server/src/index.ts` (runs on port 3000)
- **App**: `bun run --filter @effect-monorepo/app dev` (runs on port 5173)
- **CLI**: `bun packages/cli/src/index.ts [command]`
- **Contract**: Only compiles, no runtime

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ESNext module output, strict mode enabled
- **Module Resolution**: `bundler` mode with `verbatimModuleSyntax`
- **Strict Type Checking**: `strict: true`, `noUncheckedIndexedAccess: true`
- **No Emit**: TypeScript is compile-only, bundlers handle output

### Imports & Module Format
- **Format**: ES modules (`"type": "module"` in package.json)
- **Path Aliases**: Use full workspace paths: `@effect-monorepo/contract`
- **Internal Imports**: Use `.js` extension: `import { handler } from "./handlers.js"`
- **Order Convention**:
  1. External packages (Effect, @effect/*)
  2. Local workspace imports (@effect-monorepo/*)
  3. Relative file imports (./local-file.js)

**Examples**:
```typescript
import { HttpRouter } from "@effect/platform"
import { Effect, Layer, Ref } from "effect"
import { UsersRpcs } from "@effect-monorepo/contract"
import { handlers } from "./handlers.js"
```

### Naming Conventions
- **Classes**: PascalCase (User, UsersStore, RpcServer)
- **Functions**: camelCase (getUsers, createUser, makeUsersStore)
- **Constants**: camelCase or UPPER_SNAKE_CASE
- **Type Names**: PascalCase
- **File Names**: 
  - Components: PascalCase (App.tsx)
  - Utils/handlers: camelCase (handlers.ts, client.ts)

### Code Organization with Effect Functional Programming

#### Effect Pattern - gen() generators
Use `Effect.gen()` for imperative-style functional code:
```typescript
const program = Effect.gen(function* () {
  const store = yield* UsersStore      // Access services
  const result = yield* store.getAll   // Wait for effects
  return result
})
```

#### Layer Pattern - Service provision
- Wrap service implementations in `Layer`:
```typescript
export class UsersStore extends Effect.Tag("UsersStore")<UsersStore, StoreType>() {
  static Live = Layer.effect(this, makeUsersStore)
}
```
- Provide layers to effects: `effect.pipe(Effect.provide(layer))`

#### RPC Definitions
- Define schemas in contract package using `Schema.Class` and `RpcGroup.make()`
- Implement handlers with `RpcGroup.toLayer()` in server
- Client wraps with `RpcClient.make()` (use `Effect.scoped` in Node/CLI)
- In browser, use `AtomRpc.Tag` pattern for proper integration

#### RPC Client Patterns

**For Node.js/CLI (Effect CLI commands):**
```typescript
const program = Effect.gen(function* () {
  const client = yield* RpcClient.make(UsersRpcs)
  const users = yield* client.GetUsers({})
  return users
}).pipe(
  Effect.scoped,  // CRITICAL: Required for resource management
  Effect.provide(ProtocolLayer)
)
```

**For Browser (React with effect-atom):**
```typescript
import { AtomRpc } from "@effect-atom/atom-react"

// Create RPC client as a service
export class UsersClient extends AtomRpc.Tag<UsersClient>()("UsersClient", {
  group: UsersRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc/users"  // Note: Use specific path, not just /rpc
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson)  // CRITICAL: Must match server serialization
  )
}) {}

// Query atoms with reactivity keys
export const usersAtom = UsersClient.query("GetUsers", {}, {
  reactivityKeys: ["users"]
})

// Mutation atoms that invalidate queries
export const createUserAtom = UsersClient.mutation("CreateUser")
```

### Formatting & Style
- **Indentation**: 2 spaces (TypeScript default)
- **Line Length**: No hard limit enforced, use judgment
- **Semicolons**: Required (TypeScript default)
- **Quotes**: Double quotes for JSX attributes, follow editor defaults
- **Comments**: Use for non-obvious logic only; self-documenting code preferred

### Error Handling
- **Use Effect for errors**: Return `Effect.fail()` for controlled errors
- **Error Types**: Use strings or custom error types with RPC
- **Validation**: Use Schema.validate() for data validation
- **Stack Traces**: Effect provides automatic error tracking

### Type Annotations
- **Explicit types**: Use type annotations on exported functions
- **Inferred types**: OK for internal/local variables
- **Schema.Class**: Preferred for data models with serialization

**Example**:
```typescript
export const createUser = (name: string, email: string) =>
  Effect.gen(function* () {
    // ...
  })
```

## Development Workflow

### Adding New RPC Methods
1. Define in `packages/contract/src/index.ts` (add to `RpcGroup.make()`)
2. Implement handler in `packages/server/src/handlers.ts`
3. Use in app via `UsersClient.query()` or `UsersClient.mutation()`
4. Test with CLI: add new command in `packages/cli/src/index.ts`

### RPC Server Setup (IMPORTANT)

When setting up an RPC server with CORS support, use `RpcServer.layerHttpRouter()`:

```typescript
import { HttpLayerRouter } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { RpcServer, RpcSerialization } from "@effect/rpc"
import { Layer } from "effect"

// Create the RPC server layer with HTTP router
const RpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc/users",  // Specific path for this RPC group
  protocol: "http"  // CRITICAL: Use "http" for HTTP POST (default is "websocket")
}).pipe(
  Layer.provide(UsersRpcsLive),
  Layer.provide(UsersStore.Live),
  Layer.provide(RpcSerialization.layerNdjson),  // CRITICAL: Must match client serialization
  Layer.provide(HttpLayerRouter.cors()) // Enable CORS for browser access
)

// Start the HTTP server with the RPC route
const Main = HttpLayerRouter.serve(RpcRoute).pipe(
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

BunRuntime.runMain(Layer.launch(Main))
```

**Key Points:**
- `protocol: "http"` is **required** if your client uses HTTP POST (the default is WebSocket)
- `HttpLayerRouter.cors()` enables CORS with sensible defaults (`Access-Control-Allow-Origin: *`)
- You can customize CORS with options: `HttpLayerRouter.cors({ allowedOrigins: [...], ... })`
- `RpcServer.layerHttpRouter()` is the modern, recommended approach (replaces older `layerProtocolHttp` pattern)

### Running Code
- **Dev**: `bun run dev` starts both server (port 3000) and app (port 5173)
- **TypeCheck**: `bun run typecheck` before committing
- **Build**: `bun run build` compiles all packages

### Package Dependencies
- All packages export through `package.json#exports`
- Contract is dependency-free (only Effect)
- Server depends on contract
- App depends on contract
- Cross-package refs use workspace protocol: `"@effect-monorepo/contract": "workspace:*"`

## No Linting Tools

This project uses **strict TypeScript** only—no ESLint, Prettier, or Biome configured.
Maintain code quality through:
- Type safety (strict mode enabled)
- Manual code review
- IDE auto-formatting defaults
- Effect patterns for consistency

## Common Pitfalls & Solutions

### OpenTelemetry Integration

This project uses **@effect/opentelemetry** with the lightweight Otlp implementation for observability.

**Telemetry Strategy:**
- **Development:** Jaeger (local, traces only, simple)
- **Production:** Google Cloud Trace (Cloud Run, managed, scalable)

The application **automatically switches** between local and production telemetry based on `NODE_ENV` (server) or `import.meta.env.MODE` (client).

---

#### Local Development with Jaeger

**Starting Jaeger:**
```bash
# Start Jaeger with Docker Compose
docker compose up -d

# Verify Jaeger is running
docker ps | grep jaeger

# Stop Jaeger
docker compose down
```

**Access Jaeger UI:** http://localhost:16686

**Viewing Traces:**
1. Open Jaeger UI
2. Select service: `effect-rpc-server` or `effect-rpc-client`
3. Click "Find Traces"
4. Explore distributed traces showing the full request journey

**Local Architecture:**
```
Effect RPC App → Otlp.layerJson → Jaeger (localhost:4318)
```

**Configuration Files:**
- `packages/server/src/telemetry.ts` - Server telemetry (Jaeger)
- `packages/app/src/telemetry.ts` - Client telemetry (Jaeger)
- `otel-collector-config.yaml` - Collector config (exports to Jaeger)

---

#### Production with Google Cloud Trace

**Architecture:**
```
Effect RPC App → OTel Collector Sidecar → Google Cloud Trace API
```

**Configuration Files:**
- `packages/server/src/telemetry-gcp.ts` - Server telemetry (GCP)
- `packages/app/src/telemetry-gcp.ts` - Client telemetry (GCP)
- `otel-collector-config-gcp.yaml` - Collector config (exports to Google Cloud Trace)

**Environment Variables (Production):**
```bash
# Required for GCP integration
GCP_PROJECT_ID=your-project-id              # Your Google Cloud project
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # Collector sidecar
NODE_ENV=production                         # Triggers GCP telemetry
CLOUD_REGION=us-central1                    # GCP region

# Auto-detected by Cloud Run (no need to set)
K_SERVICE=effect-rpc-server                 # Cloud Run service name
K_REVISION=effect-rpc-server-00042-xiv      # Cloud Run revision
K_INSTANCE_ID=00bf4bf02d44ab8e...            # Instance ID
```

**How Auto-Switching Works:**

**Server (`packages/server/src/index.ts`):**
```typescript
import { TelemetryLive } from "./telemetry.js"         // Jaeger
import { TelemetryGcpLive } from "./telemetry-gcp.js"  // Google Cloud Trace

// Auto-select based on NODE_ENV
const TelemetryLayer = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging"
  ? TelemetryGcpLive  // → Google Cloud Trace
  : TelemetryLive     // → Jaeger (local)

BunRuntime.runMain(
  Layer.launch(
    HttpLayerRouter.serve(AllRoutes).pipe(
      Layer.provide(TelemetryLayer)  // 👈 Automatically switches!
    )
  )
)
```

**Client (`packages/app/src/atoms.ts`):**
```typescript
import { TelemetryLive } from "./telemetry.js"         // Jaeger
import { TelemetryGcpLive } from "./telemetry-gcp.js"  // Google Cloud Trace

// Auto-select based on Vite MODE
const TelemetryLayer = import.meta.env.MODE === "production"
  ? TelemetryGcpLive  // → Google Cloud Trace
  : TelemetryLive     // → Jaeger (local)

export class UsersClient extends AtomRpc.Tag<UsersClient>()("UsersClient", {
  group: UsersRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc/users"
  }).pipe(
    Layer.provide(TelemetryLayer)  // 👈 Automatically switches!
  )
}) {}
```

**GCP Resource Attributes:**

The `telemetry-gcp.ts` files automatically add Google Cloud resource attributes:
```typescript
{
  "cloud.provider": "gcp",
  "cloud.platform": "gcp_cloud_run",
  "cloud.region": "us-central1",
  "cloud.account.id": "your-project-id",
  "service.name": "effect-rpc-server",
  "service.version": "revision-id",
  "faas.name": "effect-rpc-server",
  "faas.instance": "instance-id"
}
```

These attributes help Google Cloud Trace properly group and identify your telemetry.

**Setting Up GCP Authentication:**

1. **Create Service Account:**
```bash
gcloud iam service-accounts create effect-rpc-telemetry \
  --display-name="Effect RPC Telemetry Service Account"
```

2. **Grant Permissions:**
```bash
# Cloud Trace Writer
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:effect-rpc-telemetry@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudtrace.agent"
```

3. **Attach to Cloud Run Service:**
```bash
gcloud run services update effect-rpc-server \
  --service-account=effect-rpc-telemetry@${PROJECT_ID}.iam.gserviceaccount.com \
  --region=us-central1
```

**Accessing Traces in GCP:**
1. Go to Google Cloud Console → **Trace** (https://console.cloud.google.com/traces)
2. Select your project
3. View traces from `effect-rpc-server` and `effect-rpc-client`
4. Explore distributed traces across services

**Cost Estimation (Google Cloud Trace):**
- **Free Tier:** First 2.5M spans/month FREE
- **Pricing:** $0.20 per million spans after free tier
- **Example:** 100 req/sec × 5 spans/req × 30 days = ~130M spans/month ≈ **$25/month**

**Cost Optimization:**
Enable sampling in `otel-collector-config-gcp.yaml`:
```yaml
processors:
  probabilistic_sampler:
    sampling_percentage: 10  # Sample 10% (reduce cost by 90%)
```

---

#### Instrumenting Code

**Creating Spans:**
```typescript
import { Effect } from "effect"

const myOperation = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan("key", "value")
  // Your logic here
}).pipe(
  Effect.withSpan("operation-name")  // Creates a named span
)
```

**Span Naming Convention (like lucas-barake repo):**
```typescript
// Pattern: ServiceName.MethodName
Effect.withSpan("UsersRepository.create")   // Database layer
Effect.withSpan("UsersService.createUser")  // Business logic layer
Effect.withSpan("TokenCipher.encrypt")      // Utility layer
```

**Adding Metrics:**
```typescript
import { Metric } from "effect"

const myCounter = Metric.counter("my_counter")
const myTimer = Metric.timer("my_timer")

const operation = Effect.gen(function* () {
  yield* Metric.increment(myCounter)
  // Your logic
}).pipe(
  Metric.trackDuration(myTimer)
)
```

**Distributed Tracing:**
Trace context automatically propagates through RPC calls between client and server. You'll see connected spans in Jaeger/GCP showing the complete request journey:
```
effect-rpc-client: CreateUser-RPC (50ms)
  └─ HTTP POST /rpc (45ms)
      └─ effect-rpc-server: RPC.CreateUser (40ms)
          └─ user.create (30ms)
```

---

#### Key Design Decisions (Minimalist Approach)

Following the pattern from [lucas-barake/effect-monorepo](https://github.com/lucas-barake/effect-monorepo):

✅ **Traces Only** - No metrics or structured logging infrastructure (keeps it simple)  
✅ **Server-Side Telemetry** - Primary focus on backend traces  
✅ **Auto-Switching** - Environment-based config switching (no manual changes)  
✅ **Lightweight** - No heavy observability stack, just OTLP export  
✅ **Effect-First** - Use `Effect.log`, `Effect.withSpan`, native patterns  

This approach provides **production-ready tracing** without the complexity of a full observability stack.

### CORS Issues with RPC Server

**Problem**: Browser shows CORS errors when accessing RPC server from different origin.

**Solution**: Ensure you're using `HttpLayerRouter.cors()` and the correct protocol:

```typescript
const RpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc",
  protocol: "http"  // Must match client protocol
}).pipe(
  Layer.provide(HttpLayerRouter.cors()) // Enable CORS
)
```

### 404 Not Found on /rpc Endpoint

**Problem**: Server logs show `RouteNotFound: POST /rpc not found`.

**Cause**: Protocol mismatch. `layerHttpRouter` defaults to `protocol: "websocket"` (GET), but clients often use HTTP POST.

**Solution**: Explicitly set `protocol: "http"` in `RpcServer.layerHttpRouter()` configuration.

### Client Connection Errors

**Problem**: CLI or browser client can't connect to RPC server.

**Checklist**:
1. ✅ Server is running on the correct port (3000)
2. ✅ Client URL matches server: `http://localhost:3000/rpc/users` (or `/rpc/auth`)
3. ✅ Server uses `protocol: "http"` if client uses HTTP POST
4. ✅ Both use same serialization: `RpcSerialization.layerNdjson` (CRITICAL: JSON vs NDJSON mismatch causes "Expected array but got null" errors)
5. ✅ CLI uses `Effect.scoped` pattern for resource management

### RPC Serialization Mismatch

**Problem**: "Expected an array of responses, but got: null" error in browser.

**Cause**: Client and server using different serialization formats:
- Server: `RpcSerialization.layerNdjson` (Newline Delimited JSON)
- Client: `RpcSerialization.layerJson` (regular JSON)

**Solution**: Ensure **both** client and server use the **same** serialization:
```typescript
// Server (packages/server/src/index.ts)
const RpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc/users",
  protocol: "http"
}).pipe(
  Layer.provide(RpcSerialization.layerNdjson)  // Use NDJSON
)

// Client (packages/app/src/atoms.ts)
export class UsersClient extends AtomRpc.Tag<UsersClient>()("UsersClient", {
  group: UsersRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc/users"
  }).pipe(
    Layer.provide(RpcSerialization.layerNdjson)  // Must match server!
  )
}) {}
```

### Shared Service Layers (AuthStorage Issue)

**Problem**: Register works but login fails with "Invalid credentials" even with correct password.

**Cause**: Each RPC handler was creating a **new instance** of `AuthStorageLive` by calling `.pipe(Effect.provide(AuthStorageLive))` in the service functions. This means:
- Register creates AuthStorage instance A, saves user
- Login creates AuthStorage instance B (empty), can't find user

**Solution**: Provide service layers at the **server level**, not in individual service functions:

```typescript
// ❌ WRONG - Don't do this in service.ts
export const login = (email: string, password: string) =>
  Effect.gen(function* () {
    const storage = yield* AuthStorage
    // ...
  }).pipe(
    Effect.provide(AuthStorageLive)  // ❌ Creates new instance each time!
  )

// ✅ CORRECT - Remove .pipe(Effect.provide(...)) from services
export const login = (email: string, password: string) =>
  Effect.gen(function* () {
    const storage = yield* AuthStorage
    // ...
  })  // ✅ No provide here

// ✅ CORRECT - Provide at server level in index.ts
BunRuntime.runMain(
  Layer.launch(
    HttpLayerRouter.serve(AllRoutes).pipe(
      Layer.provide(UsersStore.Live),
      Layer.provide(EventBus.Live),
      Layer.provide(AuthStorageLive),  // ✅ Single shared instance
      Layer.provide(BunHttpServer.layer({ port: 3000 }))
    )
  )
)
```

**Key principle**: Services that need to maintain state across requests (like storage, caches, connection pools) must be provided at the **server/application level**, not in individual request handlers.
