# AGENTS.md - Development Guide for Agentic Coding

This guide is designed for AI agents working in this Effect RPC monorepo.

## Quick Reference

### Monorepo Structure
- **contract**: RPC schema definitions using Effect RPC
- **server**: Bun HTTP server with Effect Platform
- **app**: React frontend with effect-atom
- **cli**: Command-line testing tool with Effect CLI

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
bun packages/cli/src/index.ts create "Name" "email@example.com"  # Create user
bun packages/cli/src/index.ts --help               # Show help
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
    url: "http://localhost:3000/rpc"
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerJson)
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
  path: "/rpc",
  protocol: "http"  // CRITICAL: Use "http" for HTTP POST (default is "websocket")
}).pipe(
  Layer.provide(UsersRpcsLive),
  Layer.provide(UsersStore.Live),
  Layer.provide(RpcSerialization.layerJson),
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
2. ✅ Client URL matches server: `http://localhost:3000/rpc`
3. ✅ Server uses `protocol: "http"` if client uses HTTP POST
4. ✅ Both use same serialization: `RpcSerialization.layerJson`
5. ✅ CLI uses `Effect.scoped` pattern for resource management
