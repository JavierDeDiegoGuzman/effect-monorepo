# Wide Events Implementation Guide

Inspired by **[loggingsucks.com](https://loggingsucks.com/)** - Transform your logging from scattered lines to comprehensive, query-optimized events.

## What Are Wide Events?

**Wide Events** (also called **Canonical Log Lines**) are comprehensive, structured log events that contain ALL context needed for debugging in a single line. Instead of logging "what your code is doing", you log "what happened to this request".

### The Mental Model Shift

**❌ Traditional Logging** (optimized for writing):
```typescript
logger.info("Incoming request", { method: "POST", path: "/rpc" })
logger.debug("Processing CreateUser")
logger.info("User created", { userId: "5" })
logger.info("Request completed", { status: 200, duration: 4 })
```

**✅ Wide Events** (optimized for querying):
```typescript
// One comprehensive event at the end of request:
{
  request_id: "req_abc123",
  trace_id: "d1bdfa4de01027d4",
  timestamp: "2024-01-15T10:23:45.612Z",
  duration_ms: 4,
  outcome: "success",
  
  user: {
    id: "5",
    subscription: "free",
    account_age_days: 0,
    lifetime_value_cents: 0
  },
  
  rpc: {
    method: "CreateUser",
    operation_type: "mutation"
  },
  
  feature_flags: {
    new_user_onboarding_flow: true
  }
}
```

## Architecture

### packages/server/src/wideEvent.ts

Core wide event infrastructure using Effect FiberRef for request-scoped state.

**Key Functions**:
- `initWideEvent(requestId, traceId)` - Initialize event for new request
- `updateWideEvent(partial)` - Add context throughout request
- `addUserContext(user)` - Add business context
- `addRpcContext(rpc)` - Add RPC metadata
- `addFeatureFlags(flags)` - Add feature flag state
- `emitWideEvent` - Emit final comprehensive event

### packages/server/src/handlers.ts

RPC handlers enriched with wide event tracking.

**Pattern**:
```typescript
CreateUser: (payload) =>
  Effect.gen(function* () {
    // 1. Add RPC context
    yield* addRpcContext({
      method: "CreateUser",
      operation_type: "mutation",
    })
    
    // 2. Add feature flags
    yield* addFeatureFlags({
      new_user_onboarding_flow: true,
      send_welcome_email: true,
    })
    
    // 3. Execute business logic
    const newUser = yield* store.create(payload.name, payload.email)
    
    // 4. Add user context
    yield* addUserContext({
      id: newUser.id,
      subscription: newUser.subscription,
      createdAt: newUser.createdAt,
      lifetimeValueCents: newUser.lifetimeValueCents,
    })
    
    // 5. Emit wide event (one comprehensive log)
    yield* emitWideEvent
    
    return newUser
  })
```

## Wide Event Structure

```typescript
interface WideEvent {
  // High-cardinality identifiers
  request_id: string
  trace_id?: string
  timestamp: string
  
  // Service metadata
  service: string
  version: string
  environment: string
  
  // Request outcome
  status_code?: number
  duration_ms?: number
  outcome?: "success" | "error" | "timeout"
  
  // Business context (THE KEY DIFFERENCE)
  user?: {
    id: string
    subscription?: "free" | "premium" | "enterprise"
    account_age_days?: number
    lifetime_value_cents?: number
    last_seen_days_ago?: number
  }
  
  // RPC context
  rpc?: {
    method: string
    operation_type: "query" | "mutation" | "stream"
    result_count?: number
  }
  
  // Feature flags (critical for A/B testing debugging)
  feature_flags?: Record<string, boolean>
  
  // Error details
  error?: {
    type: string
    message: string
    code?: string
    retriable?: boolean
  }
  
  // Extensible
  [key: string]: unknown
}
```

## Benefits

### 1. High-Cardinality Data

**Cardinality** = number of unique values a field can have.

- **Low cardinality**: `http_method` (GET, POST, PUT, DELETE)
- **High cardinality**: `user_id` (millions of unique values)

**High-cardinality fields enable precise filtering**:
- "Show me all requests for `user_id=user_456`"
- "Find all errors with `trace_id=abc123def456`"

### 2. High-Dimensionality Data

**Dimensionality** = number of fields in your event.

- **Low dimensionality**: 5 fields (timestamp, level, message, service, version)
- **High dimensionality**: 50+ fields (user context, feature flags, performance metrics, etc.)

**More dimensions = more questions you can answer**:
- "Show errors for premium users with new_checkout_flow enabled"
- "Compare p99 latency by subscription tier"

### 3. Query-First Thinking

Traditional logs are optimized for **writing** (`console.log("Payment failed")`).

Wide events are optimized for **querying**:
- "Show all payment failures for enterprise customers in last hour"
- "Group errors by feature flag combination"
- "Find slow requests (>500ms) for users with lifetime_value > $1000"

## Usage Examples

### Example 1: Debug User Issue

**Scenario**: User reports "can't create account"

**Traditional approach**: grep through logs, correlate timestamps, hope user ID was logged

**Wide Events approach**:
```
Jaeger Query:
- Service: effect-rpc-server
- Operation: RPC.CreateUser
- Tags: user.email=javier@tests.es, outcome=error
```

**Result**: One trace showing:
- User tried to create duplicate email
- They're a premium customer (priority support)
- Using new onboarding flow (possible bug?)
- Error is not retriable

### Example 2: Measure Feature Flag Impact

**Question**: Does `new_user_onboarding_flow` increase error rates?

**Jaeger Query** (compare two searches):
```
Search 1:
- feature_flag.new_user_onboarding_flow=true
- outcome=error

Search 2:
- feature_flag.new_user_onboarding_flow=false
- outcome=error
```

Count results → if flag=true has 3x more errors, roll it back!

### Example 3: Identify High-Value Customer Issues

**Jaeger Query**:
```
Service: effect-rpc-server
Tags:
  - outcome=error
  - user.subscription=enterprise
  - user.lifetime_value_cents>100000  (>$1000)
Lookback: Last 24 Hours
```

**Use case**: Proactively contact high-value customers experiencing problems.

## Integration with OpenTelemetry

Wide events work **alongside** OpenTelemetry:

1. **Wide event fields** → Added as **span tags** in Jaeger
2. **Distributed tracing** → Shows request flow across services
3. **Searchable in Jaeger UI** → Filter by any wide event field

**Example span in Jaeger**:
```
Span: RPC.CreateUser (duration: 4ms)
Tags:
  - user.id: 5
  - user.subscription: free
  - user.account_age_days: 0
  - rpc.method: CreateUser
  - rpc.operation_type: mutation
  - feature_flag.new_user_onboarding_flow: true
  - outcome: success
```

## Differences from Traditional Logging

| Traditional Logging | Wide Events |
|---------------------|-------------|
| Multiple log lines per request | **One event per request** |
| Scattered context | **All context in one place** |
| Optimized for writing | **Optimized for querying** |
| Low dimensionality (5-10 fields) | **High dimensionality (50+ fields)** |
| Low cardinality (status codes) | **High cardinality (user IDs, trace IDs)** |
| Hard to correlate | **request_id/trace_id links everything** |
| No business context | **Subscription tier, LTV, feature flags** |

## What We Did NOT Implement (Yet)

### Sampling

**Sampling** = keeping only X% of events to reduce costs.

**Example**: Keep 100% of errors, 1% of successful requests.

We skipped this because:
1. Development environment (low volume)
2. Jaeger is free locally
3. You want to see all traces while learning

**For production**: Implement **tail sampling** (decide after request completes):
- Keep 100% of errors
- Keep 100% of slow requests (>p99)
- Keep 100% of enterprise customers
- Random sample 5% of everything else

## When to Use Wide Events vs. Regular Logs

### Use Wide Events for:
- ✅ **Request lifecycle events** (CreateUser, GetUser, Checkout, etc.)
- ✅ **Business operations** with user context
- ✅ **Debugging production issues** ("what happened to this user?")

### Use Regular Logs for:
- ✅ **Server startup/shutdown**
- ✅ **Configuration changes**
- ✅ **Internal diagnostics** (cache hits, connection pool stats)

**Rule of thumb**: If it touches a user request, use a wide event.

## Advanced Queries

See [WIDE_EVENTS_QUERIES.md](./WIDE_EVENTS_QUERIES.md) for comprehensive query examples.

## Resources

- **Inspiration**: https://loggingsucks.com/
- **Effect Platform**: https://effect.website/docs/platform/http-server
- **OpenTelemetry**: https://opentelemetry.io/
- **Jaeger Query Docs**: https://www.jaegertracing.io/docs/latest/apis/#search
- **High-Cardinality Observability**: https://www.honeycomb.io/blog/observability-101-terminology-and-concepts

## Key Takeaways

1. **One comprehensive event per request** - Not scattered log lines
2. **Include business context** - Subscription, LTV, account age, feature flags
3. **High cardinality enables precise filtering** - user.id, request_id, trace_id
4. **High dimensionality enables complex queries** - "errors for premium users with flag X enabled"
5. **Optimize for querying, not writing** - Think "what questions will I need to answer during an incident?"

---

**Next Steps**:
1. Start dev server: `bun run dev`
2. Create a user in the UI
3. Open Jaeger: http://localhost:16686
4. Search for `RPC.CreateUser`
5. Expand the trace and see all the wide event tags!
