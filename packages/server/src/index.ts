import { HttpLayerRouter } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { RpcServer, RpcSerialization } from "@effect/rpc"
import { Layer } from "effect"
import { UsersRpcsLive, UsersStore, EventBus } from "./handlers.js"
import { UsersRpcs } from "@effect-monorepo/contract"

// Create the RPC server layer with HTTP router (using HTTP POST protocol)
// CRITICAL: Use NDJSON serialization for streaming support
const RpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc",
  protocol: "http"  // Use HTTP POST instead of default WebSocket
}).pipe(
  Layer.provide(UsersRpcsLive),
  Layer.provide(RpcSerialization.layerNdjson)  // NDJSON is required for streaming
)

// Apply CORS middleware to routes
const AllRoutes = RpcRoute.pipe(
  Layer.provide(HttpLayerRouter.cors())
)

// Start the HTTP server and provide dependencies
HttpLayerRouter.serve(AllRoutes).pipe(
  Layer.provide(UsersStore.Live),
  Layer.provide(EventBus.Live),
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
  Layer.launch,
  BunRuntime.runMain
)
