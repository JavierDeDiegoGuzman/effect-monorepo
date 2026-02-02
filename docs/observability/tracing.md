# Simplified Tracing with Effect

This guide shows the **current, simplified approach** to tracing and error handling in this monorepo.

## Philosophy

We use Effect's **built-in tracing primitives** instead of custom infrastructure:

- ✅ `Effect.annotateCurrentSpan` for adding context
- ✅ `Effect.tapError` for error handling
- ✅ `Effect.withSpan` for creating spans
- ✅ No intermediate state management (no FiberRef, no wide events)

## Basic Pattern

### 1. Add Span Annotations

```typescript
CreateUser: (payload) =>
  Effect.gen(function* () {
    // Add context as you go
    yield* Effect.annotateCurrentSpan("rpc.method", "CreateUser")
    yield* Effect.annotateCurrentSpan("operation.type", "mutation")
    yield* Effect.annotateCurrentSpan("user.email", payload.email)
    
    const user = yield* store.create(payload.name, payload.email)
    
    // Add business context
    yield* Effect.annotateCurrentSpan("user.id", user.id)
    yield* Effect.annotateCurrentSpan("user.subscription", user.subscription)
    yield* Effect.annotateCurrentSpan("user.lifetime_value_cents", user.lifetimeValueCents)
    
    return user
  })
```

### 2. Handle Errors with tapError

```typescript
CreateUser: (payload) =>
  Effect.gen(function* () {
    // ... business logic
  }).pipe(
    Effect.withSpan("RPC.CreateUser"),
    // Annotate errors when they occur
    Effect.tapError((error: unknown) =>
      Effect.annotateCurrentSpan({
        "error": true,
        "error.message": error instanceof Error ? error.message : String(error),
        "error.type": error instanceof Error ? error.constructor.name : typeof error,
      })
    )
  )
```

### 3. Validation Errors

For input validation (like in the image you shared):

```typescript
const VALIDATED_INPUT = yield* HttpServerRequest.schemaBodyJson(ChatRequest).pipe(
  Effect.tapError((error) =>
    Effect.annotateCurrentSpan({
      "http.request.error_message": error.message,
      "error.type": "validation",
    })
  )
)
```

## Complete Example

Here's a full RPC handler with tracing:

```typescript
import { Effect, Metric } from "effect"

export const UsersRpcsLive = UsersRpcs.toLayer({
  CreateUser: (payload) =>
    Effect.gen(function* () {
      // Metrics
      yield* Metric.increment(rpcCallsTotal)
      
      // Add context
      yield* Effect.annotateCurrentSpan("rpc.method", "CreateUser")
      yield* Effect.annotateCurrentSpan("operation.type", "mutation")
      yield* Effect.annotateCurrentSpan("user.name", payload.name)
      yield* Effect.annotateCurrentSpan("user.email", payload.email)
      
      // Auth
      const tokenPayload = yield* Jwt.verifyAccessToken(payload.accessToken).pipe(
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({
            "auth.error": true,
            "auth.error_message": String(error),
          })
        ),
        Effect.catchAll((error) =>
          Effect.fail(new UnauthenticatedError({ message: String(error) }))
        )
      )
      
      yield* Effect.annotateCurrentSpan("auth.userId", tokenPayload.userId)
      yield* Effect.annotateCurrentSpan("auth.email", tokenPayload.email)
      
      // Business logic
      const store = yield* UsersStore
      const newUser = yield* store.create(payload.name, payload.email)
      
      // Add user context
      yield* Effect.annotateCurrentSpan("user.id", newUser.id)
      yield* Effect.annotateCurrentSpan("user.subscription", newUser.subscription)
      yield* Effect.annotateCurrentSpan("user.lifetime_value_cents", newUser.lifetimeValueCents)
      
      return newUser
    }).pipe(
      Effect.withSpan("RPC.CreateUser"),
      Metric.trackDuration(rpcDurationMs),
      Effect.tapError((error: unknown) =>
        Effect.annotateCurrentSpan({
          "error": true,
          "error.message": error instanceof Error ? error.message : String(error),
          "error.type": error instanceof Error ? error.constructor.name : typeof error,
        })
      )
    ),
})
```

## What You Get

All annotations appear as **tags** in Jaeger:

```
Span: RPC.CreateUser (duration: 12ms)
Tags:
  - rpc.method: CreateUser
  - operation.type: mutation
  - user.id: 5
  - user.subscription: free
  - user.lifetime_value_cents: 0
  - auth.userId: 1
  - auth.email: test@example.com
```

On error:
```
Tags:
  - error: true
  - error.message: Invalid token
  - error.type: UnauthenticatedError
  - auth.error: true
  - auth.error_message: Token expired
```

## Benefits vs. Complex Infrastructure

| Aspect | Old (Wide Events) | New (Simple) |
|--------|------------------|--------------|
| **Lines of code** | 292 lines (wideEvent.ts) | 0 (built-in) |
| **State management** | FiberRef complexity | None |
| **Learning curve** | Custom abstractions | Pure Effect |
| **Type safety** | Custom types | Effect's types |
| **Maintenance** | Custom code to maintain | Framework code |
| **Flexibility** | Fixed structure | Annotate anything |

## Common Patterns

### Pattern 1: Query Operations

```typescript
GetUsers: () =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("rpc.method", "GetUsers")
    yield* Effect.annotateCurrentSpan("operation.type", "query")
    
    const users = yield* store.getAll
    
    yield* Effect.annotateCurrentSpan("result.count", users.length)
    
    return users
  }).pipe(
    Effect.withSpan("RPC.GetUsers"),
    Effect.tapError((error: unknown) =>
      Effect.annotateCurrentSpan({
        "error": true,
        "error.message": String(error),
      })
    )
  )
```

### Pattern 2: Mutations with Auth

```typescript
CreateUser: (payload) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("rpc.method", "CreateUser")
    
    // Auth check with error annotation
    const token = yield* Jwt.verify(payload.token).pipe(
      Effect.tapError((error) =>
        Effect.annotateCurrentSpan({
          "auth.error": true,
          "auth.error_message": String(error),
        })
      )
    )
    
    const result = yield* createUser(payload)
    
    yield* Effect.annotateCurrentSpan("result.id", result.id)
    
    return result
  }).pipe(
    Effect.withSpan("RPC.CreateUser"),
    Effect.tapError((error: unknown) =>
      Effect.annotateCurrentSpan({
        "error": true,
        "error.message": String(error),
      })
    )
  )
```

### Pattern 3: Not Found Errors

```typescript
GetUser: (payload) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("rpc.method", "GetUser")
    yield* Effect.annotateCurrentSpan("user.id", payload.id)
    
    const user = yield* store.getById(payload.id)
    
    yield* Effect.annotateCurrentSpan("user.subscription", user.subscription)
    yield* Effect.annotateCurrentSpan("result.found", true)
    
    return user
  }).pipe(
    Effect.withSpan("RPC.GetUser"),
    Effect.tapError((error) =>
      Effect.annotateCurrentSpan({
        "error": true,
        "error.message": String(error),
        "error.type": "not_found",
      })
    )
  )
```

## Viewing Traces

1. **Start Jaeger**: `docker compose up -d`
2. **Open Jaeger UI**: http://localhost:16686
3. **Select service**: `effect-rpc-server`
4. **Search by tags**: 
   - `rpc.method=CreateUser`
   - `error=true`
   - `user.subscription=premium`

See [jaeger-ui.md](./jaeger-ui.md) for detailed Jaeger usage.

## Key Takeaways

1. **Keep it simple** - Use Effect's built-in tools
2. **Annotate as you go** - Add context when you have it
3. **Use tapError consistently** - Every RPC handler should have it
4. **Add business context** - Not just technical (user.subscription, user.lifetime_value_cents)
5. **Make it searchable** - Think about what you'll query in Jaeger

---

**Next**: [Jaeger UI Guide](./jaeger-ui.md)
