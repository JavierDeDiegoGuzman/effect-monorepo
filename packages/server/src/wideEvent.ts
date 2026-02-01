/**
 * Wide Events / Canonical Log Lines Implementation
 * 
 * Inspired by https://loggingsucks.com/
 * 
 * Key principles:
 * 1. One comprehensive event per request (not scattered log lines)
 * 2. High-cardinality, high-dimensionality data
 * 3. Business context included (subscription, ltv, feature flags)
 * 4. Optimized for querying, not just writing
 */

import { Effect, Context, FiberRef } from "effect"

/**
 * Wide Event structure - contains everything we might need for debugging
 */
export interface WideEvent {
  // Request identifiers (high cardinality)
  request_id: string
  trace_id?: string
  timestamp: string
  
  // Service metadata
  service: string
  version: string
  environment: string
  
  // Request details
  method?: string
  path?: string
  status_code?: number
  duration_ms?: number
  outcome?: "success" | "error" | "timeout"
  
  // User context (business context)
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
    payload_size_bytes?: number
    result_count?: number
  }
  
  // Feature flags (critical for correlating issues with rollouts)
  feature_flags?: Record<string, boolean>
  
  // Error details (if applicable)
  error?: {
    type: string
    message: string
    code?: string
    retriable?: boolean
    stack?: string
  }
  
  // Performance metrics
  performance?: {
    db_queries?: number
    cache_hits?: number
    cache_misses?: number
    external_calls?: number
  }
  
  // Custom dimensions (extensible)
  [key: string]: unknown
}

/**
 * Service for managing wide events in the current fiber
 * This allows us to build up the event throughout request processing
 */
export class WideEventService extends Context.Tag("WideEventService")<
  WideEventService,
  {
    readonly get: Effect.Effect<WideEvent>
    readonly update: (fn: (event: WideEvent) => WideEvent) => Effect.Effect<void>
    readonly set: (event: Partial<WideEvent>) => Effect.Effect<void>
  }
>() {}

/**
 * FiberRef to store the wide event for the current request
 * Each fiber (request) has its own isolated wide event
 */
export const currentWideEvent = FiberRef.unsafeMake<WideEvent>({
  request_id: "unknown",
  timestamp: new Date().toISOString(),
  service: process.env.SERVICE_NAME || "effect-rpc-server",
  version: process.env.SERVICE_VERSION || "1.0.0",
  environment: process.env.NODE_ENV || "development",
})

/**
 * Initialize a wide event for a new request
 */
export const initWideEvent = (requestId: string, traceId?: string) =>
  FiberRef.set(currentWideEvent, {
    request_id: requestId,
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || "effect-rpc-server",
    version: process.env.SERVICE_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  })

/**
 * Update the wide event with additional context
 */
export const updateWideEvent = (update: Partial<WideEvent>) =>
  Effect.gen(function* () {
    const current = yield* FiberRef.get(currentWideEvent)
    yield* FiberRef.set(currentWideEvent, { ...current, ...update })
  })

/**
 * Add user context to the wide event
 */
export const addUserContext = (user: {
  id: string
  subscription?: "free" | "premium" | "enterprise"
  createdAt?: number
  lifetimeValueCents?: number
  lastSeenAt?: number
}) =>
  Effect.gen(function* () {
    const now = Date.now()
    const accountAgeDays = user.createdAt
      ? Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24))
      : undefined
    const lastSeenDaysAgo = user.lastSeenAt
      ? Math.floor((now - user.lastSeenAt) / (1000 * 60 * 60 * 24))
      : undefined

    yield* updateWideEvent({
      user: {
        id: user.id,
        subscription: user.subscription,
        account_age_days: accountAgeDays,
        lifetime_value_cents: user.lifetimeValueCents,
        last_seen_days_ago: lastSeenDaysAgo,
      },
    })
  })

/**
 * Add RPC context to the wide event
 */
export const addRpcContext = (rpc: {
  method: string
  operation_type: "query" | "mutation" | "stream"
  result_count?: number
}) =>
  updateWideEvent({ rpc })

/**
 * Add feature flags to the wide event
 */
export const addFeatureFlags = (flags: Record<string, boolean>) =>
  updateWideEvent({ feature_flags: flags })

/**
 * Add error context to the wide event
 */
export const addErrorContext = (error: {
  type: string
  message: string
  code?: string
  retriable?: boolean
  stack?: string
}) =>
  updateWideEvent({ 
    error,
    outcome: "error" as const
  })

/**
 * Mark request as successful
 */
export const markSuccess = (statusCode: number) =>
  updateWideEvent({
    status_code: statusCode,
    outcome: "success" as const,
  })

/**
 * Emit the wide event (called at end of request)
 * This is where the magic happens - one comprehensive log line
 */
export const emitWideEvent = Effect.gen(function* () {
  const event = yield* FiberRef.get(currentWideEvent)
  
  // Log as structured JSON (can be ingested by log aggregators)
  yield* Effect.log("Wide Event", event)
  
  // Also add as span annotations for Jaeger
  yield* Effect.annotateCurrentSpan("wide_event", JSON.stringify(event))
  
  // Add individual fields as span tags for better searchability
  if (event.user) {
    yield* Effect.annotateCurrentSpan("user.id", event.user.id)
    if (event.user.subscription) {
      yield* Effect.annotateCurrentSpan("user.subscription", event.user.subscription)
    }
    if (event.user.account_age_days !== undefined) {
      yield* Effect.annotateCurrentSpan("user.account_age_days", event.user.account_age_days)
    }
  }
  
  if (event.rpc) {
    yield* Effect.annotateCurrentSpan("rpc.method", event.rpc.method)
    yield* Effect.annotateCurrentSpan("rpc.operation_type", event.rpc.operation_type)
    if (event.rpc.result_count !== undefined) {
      yield* Effect.annotateCurrentSpan("rpc.result_count", event.rpc.result_count)
    }
  }
  
  if (event.feature_flags) {
    for (const [key, value] of Object.entries(event.feature_flags)) {
      yield* Effect.annotateCurrentSpan(`feature_flag.${key}`, value)
    }
  }
  
  if (event.error) {
    yield* Effect.annotateCurrentSpan("error.type", event.error.type)
    yield* Effect.annotateCurrentSpan("error.message", event.error.message)
    if (event.error.code) {
      yield* Effect.annotateCurrentSpan("error.code", event.error.code)
    }
  }
  
  yield* Effect.annotateCurrentSpan("outcome", event.outcome || "unknown")
})

/**
 * Wrap an Effect with wide event tracking
 * Automatically emits the event when the effect completes
 */
export const withWideEvent = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    
    try {
      const result = yield* effect
      
      // Update duration
      yield* updateWideEvent({
        duration_ms: Date.now() - startTime,
      })
      
      // Emit the wide event
      yield* emitWideEvent
      
      return result
    } catch (error) {
      // Update duration and add error
      yield* updateWideEvent({
        duration_ms: Date.now() - startTime,
      })
      
      if (error instanceof Error) {
        yield* addErrorContext({
          type: error.name,
          message: error.message,
          stack: error.stack,
        })
      }
      
      // Emit the wide event even on error
      yield* emitWideEvent
      
      throw error
    }
  })

/**
 * Generate a simple request ID
 */
export const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
