# Effect RPC Monorepo

A full-stack TypeScript monorepo demonstrating Effect RPC with:
- **contract**: Shared RPC schema definitions (users + auth)
- **server**: Bun HTTP server with Effect Platform
- **app**: React frontend with effect-atom for reactive state management
- **cli**: Command-line tool for testing RPC endpoints with full auth workflow

## Structure

```
effect-monorepo/
├── packages/
│   ├── contract/      # Shared RPC schemas and definitions
│   ├── server/        # Bun server with @effect/platform-bun
│   ├── app/           # React frontend with effect-atom
│   └── cli/           # CLI testing tool with @effect/cli
└── package.json       # Workspace root
```

## Installation

```bash
bun install
```

## Quick Start

### Start Everything (Server + App)
```bash
bun run dev
```

This launches both services:
- Server: `http://localhost:3000` (cyan)
- App: `http://localhost:5173` (green)

### Start Individual Services

**Server only:**
```bash
bun run dev:server
# or
bun packages/server/src/index.ts
```

**App only:**
```bash
bun run dev:app
```

**CLI usage:**
```bash
# Authentication
bun packages/cli/src/index.ts register "Name" "email@test.com" "password123"
bun packages/cli/src/index.ts login "email@test.com" "password123"

# User management
bun packages/cli/src/index.ts list
bun packages/cli/src/index.ts create "Name" "email@test.com" "<access-token>"
bun packages/cli/src/index.ts get "1"

# Full workflow test (register -> create -> logout -> login)
bun packages/cli/src/index.ts test-workflow

# Get help
bun packages/cli/src/index.ts --help
```

## Features

### Contract Package
Defines the RPC schemas and requests:
- `User`: User schema with id, name, email, and subscription details
- `AuthUser`: Authentication user with password hash
- `UsersRpcs`: RPC group with GetUsers, GetUser, CreateUser, and SubscribeEvents
- `AuthRpcs`: RPC group with Login, Register, Refresh, Logout, and Me
- Shared by server, app, and cli packages

### Server Package
Implements the HTTP server with Effect Platform:
- Uses `@effect/platform-bun` for HTTP server
- Implements handlers for both users and auth RPC groups
- In-memory stores using Effect `Ref` (UsersStore, AuthStorage)
- Layer-based architecture with `Layer.launch()`
- JWT-based authentication with access and refresh tokens
- CORS enabled via `HttpLayerRouter.cors()` for browser access
- HTTP POST protocol with NDJSON serialization for RPC communication
- OpenTelemetry integration with Jaeger for observability

### App Package
React frontend with effect-atom:
- Uses `AtomRpc` for type-safe RPC client integration
- Reactive state management with effect-atom
- Automatic query invalidation using reactivity keys
- Built with Vite for fast development

### CLI Package
Command-line testing tool:
- Manual argument parsing (no @effect/cli dependency)
- Full authentication workflow: register, login, logout
- User management: list, create, get
- Type-safe RPC client with `Effect.scoped`
- `test-workflow` command for end-to-end testing
- Perfect for testing and debugging RPC endpoints

## Key Patterns

### AtomRpc for Browser (App Package)
```typescript
import { AtomRpc } from "@effect-atom/atom-react"

export class UsersClient extends AtomRpc.Tag<UsersClient>()("UsersClient", {
  group: UsersRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc/users"  // Specific path for users RPC
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson)  // Must match server
  )
}) {}

// Query with automatic reactivity
export const usersAtom = UsersClient.query("GetUsers", {}, {
  reactivityKeys: ["users"]
})

// Mutation that invalidates queries
export const createUserAtom = UsersClient.mutation("CreateUser")
```

### Effect.scoped for Node/CLI
```typescript
const program = Effect.gen(function* () {
  const client = yield* RpcClient.make(UsersRpcs)
  const users = yield* client.GetUsers({})
  return users
}).pipe(
  Effect.scoped,  // Required for resource management
  Effect.provide(ProtocolLayer)
)
```

### RPC Server with CORS (Server Package)
```typescript
import { HttpLayerRouter } from "@effect/platform"
import { RpcServer, RpcSerialization } from "@effect/rpc"

// Create RPC server with HTTP POST protocol and CORS
const UsersRpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc/users",  // Specific path for this RPC group
  protocol: "http"  // Use HTTP POST (default is WebSocket)
}).pipe(
  Layer.provide(UsersRpcsLive),
  Layer.provide(RpcSerialization.layerNdjson),  // Must match client
  Layer.provide(HttpLayerRouter.cors()) // Enable CORS
)

const AuthRpcRoute = RpcServer.layerHttpRouter({
  group: AuthRpcs,
  path: "/rpc/auth",
  protocol: "http"
}).pipe(
  Layer.provide(authHandlers),
  Layer.provide(RpcSerialization.layerNdjson)
)

// Merge all RPC routes
const AllRoutes = Layer.mergeAll(UsersRpcRoute, AuthRpcRoute).pipe(
  Layer.provide(HttpLayerRouter.cors())
)

// Start the server with shared services
const Main = HttpLayerRouter.serve(AllRoutes).pipe(
  Layer.provide(UsersStore.Live),
  Layer.provide(AuthStorageLive),  // Shared across requests
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

BunRuntime.runMain(Layer.launch(Main))  // Keeps server alive
```

## Scripts

```bash
# Type-check all packages
bun run typecheck

# Build all packages
bun run build

# Run dev mode (server + app)
bun run dev

# Individual package commands
bun run --filter @effect-monorepo/server dev
bun run --filter @effect-monorepo/app dev
bun run --filter @effect-monorepo/cli typecheck
```

## Documentation

### 📚 Main Guides
- **[Tracing Guide](./docs/observability/tracing.md)** ⭐ - Simplified tracing with Effect (start here!)
- **[Complete Guide](./docs/development/COMPLETE_GUIDE.md)** - Comprehensive guide with all patterns
- **[CLI Usage Guide](./packages/cli/README.md)** - Command-line tool documentation

### 🔍 Observability
- **[Observability Overview](./docs/observability/OBSERVABILITY.md)** - Architecture and setup
- **[Jaeger UI Guide](./docs/observability/jaeger-ui.md)** - Using the Jaeger web interface
- **[View Traces](./docs/observability/view-traces.md)** - Quick guide to viewing traces

### 🛠️ Development
- **[AI Agents Guide](./docs/development/AGENTS.md)** - For AI agents working with this codebase
- **[Dev Logs](./docs/development/DEV-LOGS.md)** - Development troubleshooting

See **[docs/](./docs/)** for all documentation.

## Architecture Highlights

- **Type Safety**: End-to-end type safety from contract to UI
- **Effect RPC**: Schema-driven RPC with automatic serialization
- **Reactive State**: effect-atom for reactive queries and mutations
- **Layer Composition**: Modular service architecture with Effect layers
- **Resource Management**: Automatic cleanup with Effect scopes
- **Reactivity Keys**: Automatic query invalidation on mutations
- **CORS Support**: Full cross-origin support for browser clients
- **HTTP POST Protocol**: Standard HTTP with NDJSON serialization
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Shared Services**: Singleton services (storage, event bus) at server level
- **OpenTelemetry**: Distributed tracing with Jaeger integration

## Testing

Test the RPC endpoints using any of these methods:

**CLI (easiest):**
```bash
# Authentication workflow
bun packages/cli/src/index.ts register "Test User" "test@example.com" "password123"
bun packages/cli/src/index.ts login "test@example.com" "password123"

# List users
bun packages/cli/src/index.ts list

# Full workflow test
bun packages/cli/src/index.ts test-workflow
```

**curl (for users endpoint):**
```bash
curl -X POST http://localhost:3000/rpc/users \
  -H "Content-Type: application/json" \
  -d '{"_tag":"Request","id":"1","tag":"GetUsers","payload":{},"traceId":"t","spanId":"s","sampled":true,"headers":[]}'
```

**curl (for auth endpoint):**
```bash
curl -X POST http://localhost:3000/rpc/auth \
  -H "Content-Type: application/json" \
  -d '{"_tag":"Request","id":"1","tag":"Register","payload":{"name":"Test","email":"test@example.com","password":"password123"},"traceId":"t","spanId":"s","sampled":true,"headers":[]}'
```

**Web UI:**
Open http://localhost:5173 and use the form

## Technologies

- **Effect**: Functional effect system for TypeScript
- **Effect RPC**: Type-safe remote procedure calls
- **effect-atom**: Reactive state management for Effect
- **Bun**: Fast JavaScript runtime and package manager
- **React**: UI library
- **Vite**: Build tool and dev server
- **TypeScript**: Static typing
- **OpenTelemetry**: Observability and distributed tracing
- **Jaeger**: Trace visualization

## Common Issues & Solutions

### RPC Serialization Mismatch
**Error**: "Expected an array of responses, but got: null"

**Cause**: Client and server using different serialization (JSON vs NDJSON)

**Solution**: Ensure both use `RpcSerialization.layerNdjson`:
```typescript
// Server
Layer.provide(RpcSerialization.layerNdjson)

// Client  
Layer.provide(RpcSerialization.layerNdjson)
```

### Shared Storage Not Persisting
**Problem**: Register works but login fails with "Invalid credentials"

**Cause**: Service layers (like `AuthStorageLive`) being provided in individual handlers, creating new instances per request

**Solution**: Provide storage at server level:
```typescript
// ✅ CORRECT - Server level
BunRuntime.runMain(
  Layer.launch(
    HttpLayerRouter.serve(AllRoutes).pipe(
      Layer.provide(AuthStorageLive)  // Single shared instance
    )
  )
)

// ❌ WRONG - Handler level
export const login = (email, password) =>
  Effect.gen(function* () {
    // ...
  }).pipe(
    Effect.provide(AuthStorageLive)  // Creates new instance!
  )
```

**Rule**: Services that maintain state (storage, caches, event buses) must be provided at the server/application level, not in individual handlers.

### RPC Endpoint 404 Not Found
**Problem**: Client gets 404 when calling RPC endpoint

**Solution**: Check these:
1. Server uses `protocol: "http"` (default is "websocket")
2. Client URL matches server path exactly (e.g., `/rpc/users` not `/rpc`)
3. Server is running and port is correct (3000)

### Observability
**Jaeger UI**: http://localhost:16686
- Services: `effect-rpc-server`, `effect-rpc-client`
- View distributed traces across client and server
- Start Jaeger: `docker compose up -d`
