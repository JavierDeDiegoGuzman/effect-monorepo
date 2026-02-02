# Implementing "Logging Sucks" Principles

This project demonstrates how to implement the concepts from **[loggingsucks.com](https://loggingsucks.com/)** in a real Effect-TS application.

## What We Implemented

### ✅ Wide Events / Canonical Log Lines

**One comprehensive event per request** instead of scattered log lines:

```typescript
// Before (traditional logging):
logger.info("Request started")
logger.debug("Processing CreateUser")
logger.info("User created", { userId: "5" })
logger.info("Request completed")

// After (wide events):
{
  request_id: "req_abc123",
  trace_id: "d1bdfa4de01027d4",
  duration_ms: 4,
  outcome: "success",
  user: {
    id: "5",
    subscription: "free",
    account_age_days: 0,
    lifetime_value_cents: 0
  },
  rpc: { method: "CreateUser", operation_type: "mutation" },
  feature_flags: { new_user_onboarding_flow: true }
}
```

### ✅ High-Cardinality Data

Fields with many unique values that enable precise filtering:
- `user.id` - Millions of possible values
- `request_id` - Every request is unique
- `trace_id` - Distributed tracing across services

**Enables queries like**: "Show all requests for user_id=user_456"

### ✅ High-Dimensionality Data

50+ fields per event (vs. typical 5-10):
- User context: subscription, lifetime_value, account_age
- RPC context: method, operation_type, result_count
- Feature flags: which experiments were enabled
- Performance metrics: duration, error details

**Enables queries like**: "Show errors for premium users with new_checkout_flow enabled"

### ✅ Business Context

Not just technical data, but **business data**:
- User's subscription tier (free/premium/enterprise)
- Lifetime value in cents
- Account age in days
- Last seen timestamp

**Why?** During an incident, you need to know:
- Is this affecting high-value customers? (prioritize!)
- Is this a new vs. long-time user? (context matters!)
- What's their subscription tier? (SLA implications!)

### ✅ Feature Flag Tracking

Every event includes which feature flags were enabled:

```typescript
feature_flags: {
  new_user_onboarding_flow: true,
  auto_assign_free_trial: false,
  send_welcome_email: true
}
```

**Why?** Correlate issues with feature rollouts:
- "Are errors only happening when flag X is enabled?"
- "Does the new flow have worse performance?"

### ✅ Query-First Design

Events are structured for the questions you'll ask during incidents:

**Traditional**: "I hope we logged the right thing"
**Wide Events**: "What questions will I need to answer?"

Common questions:
- ✅ "Show errors for premium users in last hour"
- ✅ "Compare performance with/without feature flag"
- ✅ "Find slow requests (>500ms) for enterprise customers"
- ✅ "Group errors by subscription tier and feature flags"

## What We Did NOT Implement

### ❌ Sampling (Intentionally Skipped)

**Sampling** = keeping only X% of events to reduce costs.

We skipped this because:
1. Development environment (low volume)
2. Learning phase (want to see all traces)
3. Jaeger is free locally

**For production**, you'd implement **tail sampling**:
- Keep 100% of errors
- Keep 100% of slow requests
- Keep 100% of VIP customers
- Random sample 5% of everything else

## Architecture

### Files Created/Modified

1. **`packages/contract/src/index.ts`** - Added business context fields to User schema
2. **`packages/server/src/wideEvent.ts`** - Wide event infrastructure (NEW)
3. **`packages/server/src/handlers.ts`** - Enriched handlers with wide events
4. **`WIDE_EVENTS_GUIDE.md`** - Implementation guide
5. **`WIDE_EVENTS_QUERIES.md`** - Query examples and use cases
6. **`LOGGING_SUCKS.md`** - This file

### How It Works

```typescript
// 1. Handler starts
CreateUser: (payload) => Effect.gen(function* () {
  
  // 2. Add RPC context
  yield* addRpcContext({
    method: "CreateUser",
    operation_type: "mutation",
  })
  
  // 3. Add feature flags
  yield* addFeatureFlags({
    new_user_onboarding_flow: true,
  })
  
  // 4. Execute business logic
  const newUser = yield* store.create(payload.name, payload.email)
  
  // 5. Add user context
  yield* addUserContext({
    id: newUser.id,
    subscription: newUser.subscription,
    createdAt: newUser.createdAt,
    lifetimeValueCents: newUser.lifetimeValueCents,
  })
  
  // 6. Emit ONE comprehensive wide event
  yield* emitWideEvent  // 👈 One log line with everything!
  
  return newUser
})
```

## Testing the Implementation

### Start the servers:
```bash
# Terminal 1: Start Jaeger
docker compose up -d

# Terminal 2: Start dev servers
bun run dev
```

### Create a user:
1. Open http://localhost:5173
2. Create a user named "Test User"
3. Open Jaeger: http://localhost:16686

### View the wide event:
1. Service: `effect-rpc-server`
2. Operation: `RPC.CreateUser`
3. Click "Find Traces"
4. Expand the trace
5. See all the tags (wide event fields)!

### Example trace tags you'll see:
```
user.id: 3
user.subscription: free
user.account_age_days: 0
user.lifetime_value_cents: 0
rpc.method: CreateUser
rpc.operation_type: mutation
feature_flag.new_user_onboarding_flow: true
feature_flag.auto_assign_free_trial: false
feature_flag.send_welcome_email: true
outcome: success
```

## Query Examples

### Find errors for premium users:
```
Service: effect-rpc-server
Tags:
  - outcome=error
  - user.subscription=premium
```

### Compare performance by feature flag:
```
Search 1: feature_flag.new_user_onboarding_flow=true
Search 2: feature_flag.new_user_onboarding_flow=false

Compare average durations
```

### Find slow requests for high-value customers:
```
Service: effect-rpc-server
Tags:
  - user.subscription=enterprise
Min Duration: 500ms
```

See **[WIDE_EVENTS_QUERIES.md](./WIDE_EVENTS_QUERIES.md)** for 20+ query examples.

## Key Differences from Article

### What's the same:
- ✅ Wide events concept
- ✅ High-cardinality data
- ✅ High-dimensionality data
- ✅ Business context
- ✅ Feature flag tracking
- ✅ Query-first thinking

### What's different:
- **No sampling** (not needed in dev)
- **No SQL database export** (Jaeger UI is sufficient)
- **Effect-specific patterns** (using FiberRef, Effect.gen, etc.)
- **OpenTelemetry integration** (wide events → span tags)

## Benefits Demonstrated

### Before (Traditional):
```
User complains: "I can't create an account"
Developer: *greps logs for 20 minutes*
Developer: *finds scattered logs*
Developer: *manually correlates timestamps*
Developer: *still doesn't know user's subscription tier*
Time to resolution: 45 minutes
```

### After (Wide Events):
```
User complains: "I can't create an account"
Developer: Searches Jaeger for user.email=user@example.com
Developer: Sees one trace with:
  - Error: "Duplicate email"
  - User is premium (high priority!)
  - Using new onboarding flow (possible bug!)
  - Account age: 847 days (loyal customer!)
Time to resolution: 2 minutes
```

## Production Considerations

For production, you'd add:

1. **Tail Sampling**:
   ```typescript
   function shouldSample(event: WideEvent): boolean {
     if (event.outcome === "error") return true  // Always keep errors
     if (event.duration_ms > 500) return true    // Always keep slow
     if (event.user?.subscription === "enterprise") return true  // Always keep VIPs
     return Math.random() < 0.05  // Sample 5% of rest
   }
   ```

2. **Export to SQL** (ClickHouse, BigQuery):
   - Complex analytics beyond Jaeger
   - Long-term retention
   - Cost-effective at scale

3. **Alerting**:
   - "Error rate >5% for enterprise customers"
   - "P99 latency >1s with feature_flag.new_checkout_flow=true"

4. **Privacy**:
   - Scrub PII from wide events
   - Hash user IDs
   - Redact sensitive fields

## Resources

- **Inspiration**: https://loggingsucks.com/
- **Implementation Guide**: [WIDE_EVENTS_GUIDE.md](./WIDE_EVENTS_GUIDE.md)
- **Query Examples**: [WIDE_EVENTS_QUERIES.md](./WIDE_EVENTS_QUERIES.md)
- **Effect Platform**: https://effect.website/docs/platform/http-server
- **OpenTelemetry**: https://opentelemetry.io/

## Key Takeaways

1. **One event per request** - Not scattered log lines
2. **Include business context** - Subscription, LTV, account age
3. **Track feature flags** - Correlate issues with rollouts
4. **High cardinality enables filtering** - user.id, request_id, trace_id
5. **High dimensionality enables complex queries** - "errors for premium users with flag X"
6. **Optimize for querying** - Think "what will I need during an incident?"

---

**Your logs should tell the truth. The whole truth. In one line.**
