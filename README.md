# Effect RPC Monorepo

A full-stack TypeScript monorepo demonstrating Effect RPC with:
- **contract**: Shared RPC schema definitions using Effect RPC
- **server**: Bun HTTP server with Effect Platform
- **app**: React frontend with effect-atom for reactive state management
- **cli**: Command-line tool for testing RPC endpoints

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
# List all users
bun packages/cli/src/index.ts list

# Create a new user
bun packages/cli/src/index.ts create "Name" "email@example.com"

# Get help
bun packages/cli/src/index.ts --help
```

## Features

### Contract Package
Defines the RPC schemas and requests:
- `User`: User schema with id, name, and email
- `UsersRpcs`: RPC group with GetUsers and CreateUser methods
- Shared by server, app, and cli packages

### Server Package
Implements the HTTP server with Effect Platform:
- Uses `@effect/platform-bun` for HTTP server
- Implements handlers for each RPC method
- In-memory store using Effect `Ref`
- Layer-based architecture with `Layer.launch()`
- CORS enabled via `HttpLayerRouter.cors()` for browser access
- HTTP POST protocol for RPC communication

### App Package
React frontend with effect-atom:
- Uses `AtomRpc` for type-safe RPC client integration
- Reactive state management with effect-atom
- Automatic query invalidation using reactivity keys
- Built with Vite for fast development

### CLI Package
Command-line testing tool:
- Uses `@effect/cli` for command structure
- Two commands: `list` and `create`
- Type-safe RPC client with `Effect.scoped`
- Perfect for testing and debugging

## Key Patterns

### AtomRpc for Browser (App Package)
```typescript
import { AtomRpc } from "@effect-atom/atom-react"

export class UsersClient extends AtomRpc.Tag<UsersClient>()("UsersClient", {
  group: UsersRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc"
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerJson)
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
const RpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc",
  protocol: "http"  // Use HTTP POST (default is WebSocket)
}).pipe(
  Layer.provide(UsersRpcsLive),
  Layer.provide(UsersStore.Live),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(HttpLayerRouter.cors()) // Enable CORS
)

// Start the server
const Main = HttpLayerRouter.serve(RpcRoute).pipe(
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

- **[COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md)** - Comprehensive guide with all fixes and patterns
- **[AGENTS.md](./AGENTS.md)** - Development guide for AI agents
- **[packages/cli/README.md](./packages/cli/README.md)** - CLI usage guide

## Architecture Highlights

- **Type Safety**: End-to-end type safety from contract to UI
- **Effect RPC**: Schema-driven RPC with automatic serialization
- **Reactive State**: effect-atom for reactive queries and mutations
- **Layer Composition**: Modular service architecture with Effect layers
- **Resource Management**: Automatic cleanup with Effect scopes
- **Reactivity Keys**: Automatic query invalidation on mutations
- **CORS Support**: Full cross-origin support for browser clients
- **HTTP POST Protocol**: Standard HTTP for wide compatibility

## Testing

Test the RPC endpoints using any of these methods:

**CLI (easiest):**
```bash
bun packages/cli/src/index.ts list
```

**curl:**
```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{"_tag":"Request","id":"1","tag":"GetUsers","payload":{},"traceId":"t","spanId":"s","sampled":true,"headers":[]}'
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
