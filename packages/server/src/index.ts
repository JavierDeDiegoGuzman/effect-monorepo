import { HttpLayerRouter } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { RpcServer, RpcSerialization } from "@effect/rpc"
import { Effect, Layer } from "effect"
import { UsersRpcsLive, UsersStore, EventBus } from "./handlers.js"
import { UsersRpcs, AuthRpcs } from "@effect-monorepo/contract"
import { authHandlers } from "./auth/handlers.js"
import { AuthStorageLive } from "./auth/storage.js"
import { TelemetryLive } from "./telemetry.js"
import { TelemetryGcpLive } from "./telemetry-gcp.js"

/**
 * Selecciona la configuración de telemetría según el entorno:
 * - development: Usa Jaeger local (TelemetryLive)
 * - production: Usa Google Cloud Trace (TelemetryGcpLive)
 * - staging: Usa Google Cloud Trace (TelemetryGcpLive)
 * 
 * Variable de entorno: NODE_ENV
 */
const TelemetryLayer = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging"
  ? TelemetryGcpLive  // Google Cloud Trace para producción/staging
  : TelemetryLive     // Jaeger local para desarrollo

// Create the users RPC server layer
const UsersRpcRoute = RpcServer.layerHttpRouter({
  group: UsersRpcs,
  path: "/rpc/users",
  protocol: "http"
}).pipe(
  Layer.provide(UsersRpcsLive),
  Layer.provide(RpcSerialization.layerNdjson)
)

// Create the auth RPC server layer
const AuthRpcRoute = RpcServer.layerHttpRouter({
  group: AuthRpcs,
  path: "/rpc/auth",
  protocol: "http"
}).pipe(
  Layer.provide(authHandlers),
  Layer.provide(RpcSerialization.layerNdjson)
)

// Merge all RPC routes
const AllRoutes = Layer.mergeAll(UsersRpcRoute, AuthRpcRoute).pipe(
  Layer.provide(HttpLayerRouter.cors())
)

// Start the HTTP server and provide dependencies
BunRuntime.runMain(
  Layer.launch(
    HttpLayerRouter.serve(AllRoutes).pipe(
      Layer.provide(UsersStore.Live),
      Layer.provide(EventBus.Live),
      Layer.provide(AuthStorageLive),  // Add AuthStorage at server level
      Layer.provide(BunHttpServer.layer({ port: 3000 })),
      Layer.provide(TelemetryLayer)    // Auto-selects telemetry based on NODE_ENV
    )
  ) as Effect.Effect<never, never, never>
)
