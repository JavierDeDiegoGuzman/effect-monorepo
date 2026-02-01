import { Effect, Array, Ref, Stream, Queue, Layer, Schedule } from "effect"
import { User, ServerEvent, UserCreatedEvent, PingEvent } from "@effect-monorepo/contract"

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
    }),
    new User({
      id: "2",
      name: "Bob",
      email: "bob@example.com",
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

// Implement the RPC handlers
export const UsersRpcsLive = UsersRpcs.toLayer({
  GetUsers: () =>
    Effect.gen(function* () {
      const store = yield* UsersStore
      return yield* store.getAll
    }),
  GetUser: (payload) =>
    Effect.gen(function* () {
      const store = yield* UsersStore
      return yield* store.getById(payload.id)
    }),
  CreateUser: (payload) =>
    Effect.gen(function* () {
      const store = yield* UsersStore
      const eventBus = yield* EventBus
      const newUser = yield* store.create(payload.name, payload.email)
      
      // Broadcast the user.created event
      yield* eventBus.broadcast(
        new UserCreatedEvent({ type: "user.created", user: newUser })
      )
      
      return newUser
    }),
  SubscribeEvents: () =>
    Stream.unwrapScoped(
      Effect.gen(function* () {
        const eventBus = yield* EventBus
        
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
        })
      })
    ),
})
