# Effect RPC Monorepo - Complete Guide

## What We Built

A full-stack TypeScript application demonstrating Effect RPC with:
- **Server**: Bun HTTP server with Effect Platform
- **Web App**: React + effect-atom frontend  
- **CLI**: Command-line testing tool
- **Contract**: Shared RPC schema definitions

## Architecture Overview

```
effect-monorepo/
├── packages/
│   ├── contract/       # Shared RPC definitions (UsersRpcs)
│   ├── server/         # Bun HTTP server with Effect RPC
│   ├── app/            # React app with effect-atom
│   └── cli/            # CLI for testing RPC endpoints
```

## Key Fixes Applied

### 1. **CLI Package** - RPC Client with Effect.scoped
**Problem**: "Service not found: effect/Scope" error  
**Solution**: Wrap `RpcClient.make()` with `Effect.scoped`

```typescript
// packages/cli/src/index.ts
const ProtocolLayer = RpcClient.layerProtocolHttp({
  url: "http://localhost:3000/rpc"
}).pipe(
  Layer.provide([
    FetchHttpClient.layer,
    RpcSerialization.layerJson
  ])
)

const listUsers = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const client = yield* RpcClient.make(UsersRpcs)
    const users = yield* client.GetUsers({})
    // ... display users
  }).pipe(
    Effect.scoped,  // ← CRITICAL for resource management
    Effect.provide(ProtocolLayer)
  )
)
```

### 2. **Web App** - Using AtomRpc for Proper Integration
**Problem**: RPC errors in browser due to incorrect client setup  
**Solution**: Use `AtomRpc.Tag` pattern from effect-atom docs

```typescript
// packages/app/src/atoms.ts
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

// Query atom with reactivity
export const usersAtom = UsersClient.query("GetUsers", {}, {
  reactivityKeys: ["users"]
})

// Mutation atom
export const createUserAtom = UsersClient.mutation("CreateUser")
```

**In the component**:
```typescript
// Auto-refresh users list after mutation
const exit = await createUser({
  payload: { name, email },
  reactivityKeys: ["users"] // Invalidates usersAtom
})
```

### 3. **Server** - Layer.launch Pattern
**Problem**: Server not staying alive  
**Solution**: Use `Layer.launch()` instead of Effect program

```typescript
// packages/server/src/index.ts
const Main = HttpRouter.Default.serve().pipe(
  Layer.provide(RpcLayer),
  Layer.provide(HttpProtocol),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

BunRuntime.runMain(Layer.launch(Main))  // ← Keeps server alive
```

## Running the Application

### Start the Server
```bash
cd packages/server
bun src/index.ts
# Server runs on http://localhost:3000
```

### Start the Web App
```bash
cd packages/app
bun run dev
# App runs on http://localhost:5173
```

### Use the CLI
```bash
# List all users
bun packages/cli/src/index.ts list

# Create a new user
bun packages/cli/src/index.ts create "Name" "email@example.com"

# Get help
bun packages/cli/src/index.ts --help
```

## Testing the Stack

### 1. Test with CLI
```bash
# Make sure server is running first
bun packages/server/src/index.ts

# In another terminal
bun packages/cli/src/index.ts list
# Output:
# Users:
#   - Alice (alice@example.com)
#   - Bob (bob@example.com)

bun packages/cli/src/index.ts create "Charlie" "charlie@example.com"
# Output: Created user: Charlie (charlie@example.com)
```

### 2. Test with Web App
1. Open http://localhost:5173
2. Should see existing users listed
3. Fill in name and email
4. Click "Create User"
5. User list auto-refreshes with new user

### 3. Test with curl
```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{"_tag":"Request","id":"1","tag":"GetUsers","payload":{},"traceId":"t","spanId":"s","sampled":true,"headers":[]}'
```

## Key Patterns & Learnings

### Effect.scoped for Resource Management
When using `RpcClient.make()`, always wrap with `Effect.scoped`:
```typescript
Effect.gen(function* () {
  const client = yield* RpcClient.make(UsersRpcs)
  // use client
}).pipe(Effect.scoped)  // Manages Scope service
```

### AtomRpc for Browser Integration
Use `AtomRpc.Tag` instead of manual layer composition:
- Automatic reactivity with query/mutation keys
- Proper browser environment setup
- Built-in error handling

### Layer Composition
Provide multiple layers together:
```typescript
Layer.provide([
  FetchHttpClient.layer,
  RpcSerialization.layerJson
])
```

### Reactivity Keys
Link queries and mutations:
```typescript
// Query
const usersAtom = UsersClient.query("GetUsers", {}, {
  reactivityKeys: ["users"]
})

// Mutation invalidates query
await createUser({
  payload: { name, email },
  reactivityKeys: ["users"]  // Auto-refreshes usersAtom
})
```

## Package Scripts

```bash
# Build all packages
bun run build

# Type-check all packages
bun run typecheck

# Run server + app concurrently
bun run dev

# Individual package commands
bun run --filter @effect-monorepo/server dev
bun run --filter @effect-monorepo/app dev
bun run --filter @effect-monorepo/cli typecheck
```

## Dependencies

All packages use:
- `effect@^3.19.15` - Core Effect library
- `@effect/platform@^0.94.2` - Platform services
- `@effect/rpc@^0.73.0` - RPC functionality

Platform-specific:
- Server: `@effect/platform-bun`
- App: `@effect/platform-browser`, `@effect-atom/atom-react`
- CLI: `@effect/platform-node`, `@effect/cli`

## Project Structure Best Practices

1. **Contract First**: Define shared schemas in contract package
2. **Layer Composition**: Build layers from small, composable pieces
3. **Type Safety**: Let TypeScript infer types from schemas
4. **Resource Management**: Always use `Effect.scoped` for clients
5. **Reactivity**: Use reactivity keys for automatic UI updates

## Troubleshooting

### "Service not found: effect/Scope"
**Solution**: Add `Effect.scoped` to your Effect pipeline

### "Cannot find module '@effect/platform-browser'"
**Solution**: Use `FetchHttpClient` from `@effect/platform` in Node/CLI, from browser package in web apps

### Server not staying alive
**Solution**: Use `Layer.launch(Main)` instead of `Effect.provide(Layer)`

### RPC errors in browser
**Solution**: Use `AtomRpc.Tag` pattern instead of manual client creation

## Next Steps

Potential enhancements:
- Add error boundary in React app
- Add retry logic to RPC calls
- Implement authentication middleware
- Add more CRUD operations
- Add streaming data examples
- Add tests for all packages
