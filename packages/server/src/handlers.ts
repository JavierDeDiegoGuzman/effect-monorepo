import { Effect, Array, Ref, Stream, Queue, Layer, Schedule, Metric } from "effect"
import { User, ServerEvent, UserCreatedEvent, PingEvent } from "@effect-monorepo/contract"
import {
  addRpcContext,
  addUserContext,
  addFeatureFlags,
  emitWideEvent,
} from "./wideEvent.js"

// ============================================================================
// METRICS - Custom metrics for observability
// ============================================================================

// Counter for total RPC calls
const rpcCallsTotal = Metric.counter("rpc_calls_total")

// Counter for user operations
const userOperationsTotal = Metric.counter("user_operations_total")

// Timer for RPC duration
const rpcDurationMs = Metric.timer("rpc_duration_ms")

// Counter for event broadcasts
const eventBroadcastsTotal = Metric.counter("event_broadcasts_total")

// Gauge for active subscribers
const activeSubscribersGauge = Metric.gauge("active_subscribers")

// EventBus for broadcasting server-sent events to all connected clients
const makeEventBus = Effect.gen(function* () {
  const subscribers = yield* Ref.make<Array<Queue.Queue<ServerEvent>>>([])

  return {
    // Subscribe to events - returns a Stream of events
    subscribe: Stream.acquireRelease(
      Effect.gen(function* () {
        const queue = yield* Queue.unbounded<ServerEvent>()
        yield* Ref.update(subscribers, Array.append(queue))
        return queue
      }),
      (queue) => Ref.update(subscribers, Array.filter((q) => q !== queue))
    ).pipe(Stream.flatMap(Stream.fromQueue)),
    
    // Broadcast an event to all subscribers
    broadcast: (event: ServerEvent) =>
      Effect.gen(function* () {
        const subs = yield* Ref.get(subscribers)
        yield* Effect.forEach(subs, (queue) => Queue.offer(queue, event), {
          discard: true,
        })
      }),
  }
})

export class EventBus extends Effect.Tag("EventBus")<
  EventBus,
  Effect.Effect.Success<typeof makeEventBus>
>() {
  static Live = Layer.effect(this, makeEventBus)
}

// In-memory users store
const makeUsersStore = Effect.gen(function* () {
  const users = yield* Ref.make<Array<User>>([
    new User({
      id: "1",
      name: "Alice",
      email: "alice@example.com",
      createdAt: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
      subscription: "premium",
      lifetimeValueCents: 49900,
      lastSeenAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    }),
    new User({
      id: "2",
      name: "Bob",
      email: "bob@example.com",
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      subscription: "free",
      lifetimeValueCents: 0,
      lastSeenAt: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
    }),
  ])

  return {
    getAll: Ref.get(users),
    getById: (id: string) =>
      Effect.gen(function* () {
        const allUsers = yield* Ref.get(users)
        const user = allUsers.find((u) => u.id === id)
        return user
          ? Effect.succeed(user)
          : Effect.fail("User not found")
      }).pipe(Effect.flatten),
    create: (name: string, email: string) =>
      Effect.gen(function* () {
        const allUsers = yield* Ref.get(users)
        const newUser = new User({
          id: String(allUsers.length + 1),
          name,
          email,
          createdAt: Date.now(),
          subscription: "free", // Default to free tier
          lifetimeValueCents: 0,
          lastSeenAt: Date.now(),
        })
        yield* Ref.update(users, Array.append(newUser))
        return newUser
      }),
  }
})

export class UsersStore extends Effect.Tag("UsersStore")<
  UsersStore,
  Effect.Effect.Success<typeof makeUsersStore>
>() {
  static Live = Layer.effect(this, makeUsersStore)
}

import { UsersRpcs } from "@effect-monorepo/contract"

// Implement the RPC handlers with instrumentation
export const UsersRpcsLive = UsersRpcs.toLayer({
  GetUsers: () =>
    Effect.gen(function* () {
      // Increment RPC call counter
      yield* Metric.increment(rpcCallsTotal)
      
      // Add RPC context to wide event
      yield* addRpcContext({
        method: "GetUsers",
        operation_type: "query",
      })
      
      // Add span annotations (for distributed tracing)
      yield* Effect.annotateCurrentSpan("rpc.method", "GetUsers")
      yield* Effect.annotateCurrentSpan("operation.type", "query")
      
      // Example feature flags (in real app, fetch from feature flag service)
      yield* addFeatureFlags({
        new_user_list_ui: true,
        pagination_enabled: false,
      })
      
      const store = yield* UsersStore
      const users = yield* store.getAll
      
      // Annotate result count
      yield* Effect.annotateCurrentSpan("result.count", users.length)
      yield* addRpcContext({
        method: "GetUsers",
        operation_type: "query",
        result_count: users.length,
      })
      
      // Emit wide event at end of request
      yield* emitWideEvent
      
      return users
    }).pipe(
      // Create span and track duration
      Effect.withSpan("RPC.GetUsers"),
      Metric.trackDuration(rpcDurationMs)
    ),
    
  GetUser: (payload) =>
    Effect.gen(function* () {
      yield* Metric.increment(rpcCallsTotal)
      
      yield* addRpcContext({
        method: "GetUser",
        operation_type: "query",
      })
      
      yield* Effect.annotateCurrentSpan("rpc.method", "GetUser")
      yield* Effect.annotateCurrentSpan("operation.type", "query")
      yield* Effect.annotateCurrentSpan("user.id", payload.id)
      
      const store = yield* UsersStore
      const user = yield* store.getById(payload.id)
      
      // Add user context to wide event
      yield* addUserContext({
        id: user.id,
        subscription: user.subscription,
        createdAt: user.createdAt,
        lifetimeValueCents: user.lifetimeValueCents,
        lastSeenAt: user.lastSeenAt,
      })
      
      yield* Effect.annotateCurrentSpan("result.found", true)
      yield* emitWideEvent
      
      return user
    }).pipe(
      Effect.withSpan("RPC.GetUser"),
      Metric.trackDuration(rpcDurationMs),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan("error", true)
          yield* Effect.annotateCurrentSpan("error.message", error)
          yield* emitWideEvent
          return yield* Effect.fail(error)
        })
      )
    ),
    
  CreateUser: (payload) =>
    Effect.gen(function* () {
      yield* Metric.increment(rpcCallsTotal)
      yield* Metric.increment(userOperationsTotal)
      
      yield* addRpcContext({
        method: "CreateUser",
        operation_type: "mutation",
      })
      
      yield* Effect.annotateCurrentSpan("rpc.method", "CreateUser")
      yield* Effect.annotateCurrentSpan("operation.type", "mutation")
      yield* Effect.annotateCurrentSpan("user.name", payload.name)
      yield* Effect.annotateCurrentSpan("user.email", payload.email)
      
      // Example feature flags (in real app, these would affect business logic)
      yield* addFeatureFlags({
        new_user_onboarding_flow: true,
        auto_assign_free_trial: false,
        send_welcome_email: true,
      })
      
      const store = yield* UsersStore
      const eventBus = yield* EventBus
      const newUser = yield* store.create(payload.name, payload.email)
      
      yield* Effect.annotateCurrentSpan("user.id", newUser.id)
      
      // Add comprehensive user context to wide event
      yield* addUserContext({
        id: newUser.id,
        subscription: newUser.subscription,
        createdAt: newUser.createdAt,
        lifetimeValueCents: newUser.lifetimeValueCents,
        lastSeenAt: newUser.lastSeenAt,
      })
      
      // Broadcast the user.created event
      yield* eventBus.broadcast(
        new UserCreatedEvent({ type: "user.created", user: newUser })
      )
      yield* Metric.increment(eventBroadcastsTotal)
      
      yield* Effect.log("User created", { userId: newUser.id, name: newUser.name })
      
      // Emit the wide event (one comprehensive log line)
      yield* emitWideEvent
      
      return newUser
    }).pipe(
      Effect.withSpan("RPC.CreateUser"),
      Metric.trackDuration(rpcDurationMs)
    ),
    
  SubscribeEvents: () =>
    Stream.unwrapScoped(
      Effect.gen(function* () {
        yield* Metric.increment(rpcCallsTotal)
        
        yield* addRpcContext({
          method: "SubscribeEvents",
          operation_type: "stream",
        })
        
        yield* Effect.annotateCurrentSpan("rpc.method", "SubscribeEvents")
        yield* Effect.annotateCurrentSpan("operation.type", "stream")
        
        yield* addFeatureFlags({
          sse_heartbeat_enabled: true,
          sse_compression: false,
        })
        
        const eventBus = yield* EventBus
        
        // Update gauge for active subscribers (increment on subscribe)
        yield* Metric.increment(activeSubscribersGauge)
        
        // Emit wide event for subscription start
        yield* emitWideEvent
        
        // Real events from the event bus
        const realEvents = eventBus.subscribe
        
        // Heartbeat stream - sends ping every 2 seconds
        // This keeps the HTTP connection alive and prevents timeouts
        // Inspired by tRPC's ping mechanism (default: 1000ms)
        const heartbeat = Stream.fromSchedule(Schedule.spaced("2 seconds")).pipe(
          Stream.map(() => 
            new PingEvent({ 
              type: "ping", 
              timestamp: Date.now() 
            })
          )
        )
        
        // Merge real events with heartbeat pings
        // Real events have priority - heartbeat only fires when idle
        return Stream.mergeAll([realEvents, heartbeat], { 
          concurrency: 2 
        }).pipe(
          // Tag each event as it's sent
          Stream.tap((event) => 
            Effect.annotateCurrentSpan("event.type", event.type)
          )
        )
      }).pipe(Effect.withSpan("RPC.SubscribeEvents"))
    ),
})
