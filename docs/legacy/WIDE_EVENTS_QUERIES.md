# Wide Events Query Examples

Inspired by [loggingsucks.com](https://loggingsucks.com/) - this document shows the power of high-cardinality, high-dimensionality logging with wide events.

## What Changed?

### Before (Traditional Logging)
```
2024-01-15T10:23:45.612Z INFO Incoming request method=POST path=/rpc
2024-01-15T10:23:45.613Z DEBUG Processing CreateUser
2024-01-15T10:23:45.615Z INFO User created userId=5
2024-01-15T10:23:45.616Z INFO Request completed status=200 duration=4ms
```

**Problem**: Scattered log lines, no business context, hard to correlate.

### After (Wide Events)
```json
{
  "timestamp": "2024-01-15T10:23:45.612Z",
  "request_id": "req_8bf7ec2d",
  "trace_id": "d1bdfa4de01027d4",
  "service": "effect-rpc-server",
  "version": "1.0.0",
  "environment": "production",
  "duration_ms": 4,
  "outcome": "success",
  "status_code": 200,
  
  "rpc": {
    "method": "CreateUser",
    "operation_type": "mutation"
  },
  
  "user": {
    "id": "5",
    "subscription": "free",
    "account_age_days": 0,
    "lifetime_value_cents": 0
  },
  
  "feature_flags": {
    "new_user_onboarding_flow": true,
    "auto_assign_free_trial": false,
    "send_welcome_email": true
  }
}
```

**Benefit**: One comprehensive event with all context. Optimized for querying, not just writing.

## Queries You Can Now Run

### 1. Find all errors for premium users in the last hour

**Before**: Impossible without grepping multiple services and correlating user IDs manually.

**After (Jaeger Query)**:
```
Service: effect-rpc-server
Tags: 
  - outcome=error
  - user.subscription=premium
Lookback: Last 1 Hour
```

**After (ClickHouse/SQL if exporting)**:
```sql
SELECT 
  request_id,
  rpc.method,
  error.message,
  user.id,
  user.lifetime_value_cents
FROM wide_events
WHERE 
  outcome = 'error'
  AND user.subscription = 'premium'
  AND timestamp > now() - INTERVAL 1 HOUR
ORDER BY timestamp DESC
```

### 2. Compare performance of requests with/without new feature flag

**Jaeger Query**:
```
Service: effect-rpc-server
Operation: RPC.CreateUser
Tags:
  - feature_flag.new_user_onboarding_flow=true
```

vs.

```
Tags:
  - feature_flag.new_user_onboarding_flow=false
```

**SQL (if exporting to database)**:
```sql
SELECT 
  feature_flags.new_user_onboarding_flow,
  COUNT(*) as request_count,
  AVG(duration_ms) as avg_duration,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration,
  COUNT(CASE WHEN outcome = 'error' THEN 1 END) as error_count
FROM wide_events
WHERE 
  rpc.method = 'CreateUser'
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY feature_flags.new_user_onboarding_flow
```

**Result**:
```
new_flow | requests | avg_ms | p99_ms | errors
---------|----------|--------|--------|-------
true     | 12,847   | 24ms   | 89ms   | 12
false    | 8,234    | 18ms   | 67ms   | 3
```

**Insight**: The new flow is slower and has more errors. Roll it back!

### 3. Find all slow requests (>100ms) for enterprise customers

**Jaeger**:
```
Service: effect-rpc-server
Tags:
  - user.subscription=enterprise
Min Duration: 100ms
```

**SQL**:
```sql
SELECT 
  request_id,
  trace_id,
  rpc.method,
  duration_ms,
  user.id,
  user.lifetime_value_cents
FROM wide_events
WHERE 
  user.subscription = 'enterprise'
  AND duration_ms > 100
  AND timestamp > now() - INTERVAL 1 HOUR
ORDER BY duration_ms DESC
LIMIT 20
```

### 4. Correlate feature flags with error rates

**SQL**:
```sql
WITH flagged_requests AS (
  SELECT 
    feature_flags,
    outcome,
    rpc.method
  FROM wide_events
  WHERE timestamp > now() - INTERVAL 6 HOUR
)
SELECT 
  rpc.method,
  feature_flags.new_checkout_flow,
  feature_flags.express_payment,
  COUNT(*) as total_requests,
  SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) as errors,
  (SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 as error_rate_pct
FROM flagged_requests
GROUP BY 
  rpc.method,
  feature_flags.new_checkout_flow,
  feature_flags.express_payment
HAVING COUNT(*) > 100
ORDER BY error_rate_pct DESC
```

### 5. Identify high-value customers experiencing issues

**SQL**:
```sql
SELECT 
  user.id,
  user.subscription,
  user.lifetime_value_cents / 100.0 as lifetime_value_dollars,
  user.account_age_days,
  COUNT(*) as error_count,
  MAX(timestamp) as last_error_at,
  STRING_AGG(DISTINCT error.message, ', ') as error_messages
FROM wide_events
WHERE 
  outcome = 'error'
  AND user.lifetime_value_cents > 10000  -- $100+ lifetime value
  AND timestamp > now() - INTERVAL 24 HOUR
GROUP BY 
  user.id,
  user.subscription,
  user.lifetime_value_cents,
  user.account_age_days
ORDER BY user.lifetime_value_cents DESC
LIMIT 50
```

**Use case**: Proactively reach out to high-value customers before they churn.

### 6. Track adoption of new features

**SQL**:
```sql
SELECT 
  DATE(timestamp) as day,
  feature_flags.new_user_onboarding_flow,
  COUNT(DISTINCT user.id) as unique_users,
  COUNT(*) as total_requests,
  AVG(duration_ms) as avg_duration
FROM wide_events
WHERE 
  rpc.method = 'CreateUser'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY 
  DATE(timestamp),
  feature_flags.new_user_onboarding_flow
ORDER BY day DESC
```

### 7. Find requests that touched specific users

**Jaeger**:
```
Service: effect-rpc-server
Tags:
  - user.id=user_456
```

**One query shows ALL interactions** with that user across all operations.

### 8. Analyze performance by subscription tier

**SQL**:
```sql
SELECT 
  user.subscription,
  rpc.method,
  COUNT(*) as request_count,
  AVG(duration_ms) as avg_duration,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99
FROM wide_events
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY user.subscription, rpc.method
ORDER BY user.subscription, rpc.method
```

**Result**:
```
subscription | method      | count  | avg  | p50 | p95  | p99
-------------|-------------|--------|------|-----|------|-----
free         | GetUsers    | 45,234 | 12ms | 8ms | 45ms | 89ms
premium      | GetUsers    | 12,847 | 18ms | 12ms| 67ms | 134ms
enterprise   | GetUsers    | 1,234  | 34ms | 28ms| 89ms | 178ms
```

**Insight**: Enterprise customers have slower queries! Investigate why (larger datasets? more complex permissions?)

## Practical Example: Debugging a Production Issue

**Scenario**: User reports "I can't create users anymore"

### Traditional Logging Approach:
1. Search for user email: 47 scattered log lines
2. Try to find request ID: not in all logs
3. Search across 5 services: 15 minutes
4. Still don't know why it failed

### Wide Events Approach:

**Single Jaeger Query**:
```
Service: effect-rpc-server
Operation: RPC.CreateUser
Tags:
  - user.email=javier@tests.es
  - outcome=error
Lookback: Last 1 Hour
```

**Result (one trace)**:
```json
{
  "request_id": "req_abc123",
  "trace_id": "d1bdfa4de01027d4",
  "timestamp": "2024-01-15T10:23:45.612Z",
  "duration_ms": 1247,
  "outcome": "error",
  
  "user": {
    "id": "5",
    "subscription": "premium",
    "account_age_days": 847,
    "lifetime_value_cents": 284700
  },
  
  "rpc": {
    "method": "CreateUser",
    "operation_type": "mutation"
  },
  
  "feature_flags": {
    "new_user_onboarding_flow": true,
    "auto_assign_free_trial": false
  },
  
  "error": {
    "type": "ValidationError",
    "message": "Email already exists",
    "code": "DUPLICATE_EMAIL",
    "retriable": false
  }
}
```

**Answer in 5 seconds**:
- Premium customer (high priority)
- Long-time user (847 days)
- Error: duplicate email
- Using new onboarding flow
- Not retriable

**Action**: Check if new onboarding flow has bug in email validation.

## Using Jaeger UI for Wide Events

### Basic Search
1. Go to http://localhost:16686
2. Service: `effect-rpc-server`
3. Operation: `RPC.CreateUser`
4. Tags: Add filters like `user.subscription=premium`
5. Click "Find Traces"

### Advanced Filtering
```
Tags (multiple):
  - outcome=error
  - user.subscription=premium
  - feature_flag.new_user_onboarding_flow=true
  
Min Duration: 100ms
Max Duration: 5000ms
Limit Results: 50
```

### Viewing a Trace
Click on any trace to see:
- Full span hierarchy
- All tags (including wide event fields)
- Duration breakdown
- Logs within spans

## Exporting to SQL Database (Optional)

For complex analytics beyond Jaeger's capabilities, export wide events to ClickHouse, BigQuery, or PostgreSQL.

**Example Otlp → ClickHouse pipeline**:
1. Jaeger receives spans with wide event tags
2. Background job exports to ClickHouse
3. Run SQL queries for deep analysis

**ClickHouse schema**:
```sql
CREATE TABLE wide_events (
  timestamp DateTime64(3),
  request_id String,
  trace_id String,
  service String,
  version String,
  environment String,
  duration_ms UInt32,
  outcome Enum('success', 'error', 'timeout'),
  
  -- Nested structures
  user Nested (
    id String,
    subscription Enum('free', 'premium', 'enterprise'),
    account_age_days UInt32,
    lifetime_value_cents UInt64
  ),
  
  rpc Nested (
    method String,
    operation_type Enum('query', 'mutation', 'stream'),
    result_count UInt32
  ),
  
  feature_flags Map(String, Bool),
  
  error Nested (
    type String,
    message String,
    code String,
    retriable Bool
  )
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, trace_id)
```

## Key Takeaways

1. **One event per request** - Not 10-20 scattered log lines
2. **Business context matters** - Subscription tier, LTV, account age
3. **Feature flags are critical** - Correlate issues with rollouts
4. **High cardinality is good** - user.id, request_id, trace_id enable precise filtering
5. **Optimize for querying** - Structure data for questions you'll ask during incidents

## Resources

- Original article: https://loggingsucks.com/
- Jaeger Query Language: https://www.jaegertracing.io/docs/latest/apis/#search
- Effect Platform HTTP: https://effect.website/docs/platform/http-server
- OpenTelemetry Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/
