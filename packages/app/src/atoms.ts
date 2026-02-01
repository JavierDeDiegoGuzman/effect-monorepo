import { Atom, AtomRpc, Result } from "@effect-atom/atom-react"
import { FetchHttpClient } from "@effect/platform"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { Reactivity } from "@effect/experimental"
import { Layer, Effect, Stream } from "effect"
import { UsersRpcs } from "@effect-monorepo/contract"
import type { User, ServerEvent } from "@effect-monorepo/contract"
import { TelemetryLive } from "./telemetry.js"

// ============================================================================
// SINGLE RPC CLIENT - One client to rule them all
// ============================================================================

// Create the ONLY RPC client using AtomRpc.Tag pattern
// This handles queries, mutations, AND streams - all in one place
export class UsersClient extends AtomRpc.Tag<UsersClient>()("UsersClient", {
  group: UsersRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc"
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson),  // CRITICAL: Use NDJSON for streaming support
    Layer.provide(TelemetryLive)  // 👈 OpenTelemetry integration
  )
}) {}

// ============================================================================
// QUERY & MUTATION ATOMS
// ============================================================================

// Query atom for getting users - uses reactivity key "users"
export const usersAtom: Atom.Atom<any> = UsersClient.query("GetUsers", {}, {
  reactivityKeys: ["users"]
})

// Form state atoms
export const nameAtom = Atom.make("").pipe(Atom.keepAlive)
export const emailAtom = Atom.make("").pipe(Atom.keepAlive)

// Mutation atom for creating users - invalidates "users" query when done
export const createUserAtom = UsersClient.mutation("CreateUser")

// ============================================================================
// STREAMING EVENTS - Using the SAME UsersClient.runtime
// ============================================================================

// Stream atom with latest value - uses UsersClient.runtime (same Reactivity instance!)
// Atom.make converts Stream<A> -> Atom<Result<A>> automatically
// This will always show the LATEST event received from the server
export const latestEventAtom = UsersClient.runtime.atom(
  Stream.unwrapScoped(
    Effect.gen(function* () {
      // Use the SAME client tag - shares the RPC connection
      const client = yield* UsersClient
      const reactivity = yield* Reactivity.Reactivity
      
      // Call the SubscribeEvents RPC - returns Stream<ServerEvent> directly (stream: true)
      // No need to yield, just return it
      return client("SubscribeEvents", {}).pipe(
        // Process each event as it arrives
        Stream.tap((event) => 
          Effect.gen(function* () {
            if (event.type === "ping") {
              // Log ping events to console
              yield* Effect.log("💓 Ping:", event.timestamp)
            } else {
              // Log real events
              yield* Effect.log("📡 New event:", event.type)
              
              // If it's a user.created event, invalidate the users query
              if (event.type === "user.created") {
                yield* Effect.log("👤 User created - invalidating users query")
                // NOW this invalidates the SAME Reactivity instance as usersAtom!
                reactivity.unsafeInvalidate(["users"])
              }
            }
          })
        ),
        // Only emit non-ping events to the atom (for UI display)
        Stream.filter(event => event.type !== "ping")
      )
    })
  )
).pipe(Atom.keepAlive)  // CRITICAL: Keep stream connection alive
