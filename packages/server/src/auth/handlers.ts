import { Effect } from "effect"
import { AuthRpcs, UserSubject, UnauthenticatedError } from "@effect-monorepo/contract"
import { login, register, refresh, logout } from "./service.js"
import { AuthStorageLive } from "./storage.js"
import * as Jwt from "./jwt.js"

export const authHandlers = AuthRpcs.toLayer({
  Login: (payload) =>
    login(payload.email, payload.password).pipe(
      Effect.withSpan("RPC.Login"),
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          "rpc.method": "Login",
          "operation.type": "mutation",
          "auth.email": payload.email,
        })
      ),
      Effect.tapError((error: unknown) =>
        Effect.annotateCurrentSpan({
          "error": true,
          "error.message": String(error),
          "error.type": "authentication",
        })
      )
    ) as any,

  Register: (payload) =>
    register(payload.name, payload.email, payload.password).pipe(
      Effect.withSpan("RPC.Register"),
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          "rpc.method": "Register",
          "operation.type": "mutation",
          "auth.email": payload.email,
          "user.name": payload.name,
        })
      ),
      Effect.tapError((error: unknown) =>
        Effect.annotateCurrentSpan({
          "error": true,
          "error.message": String(error),
          "error.type": "validation",
        })
      )
    ) as any,

  Refresh: (payload) =>
    refresh(payload.refreshToken).pipe(
      Effect.withSpan("RPC.Refresh"),
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          "rpc.method": "Refresh",
          "operation.type": "mutation",
        })
      ),
      Effect.tapError((error: unknown) =>
        Effect.annotateCurrentSpan({
          "error": true,
          "error.message": String(error),
          "error.type": "authentication",
        })
      )
    ) as any,

  Logout: (payload) =>
    logout(payload.refreshToken).pipe(
      Effect.map(() => undefined),
      Effect.withSpan("RPC.Logout"),
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          "rpc.method": "Logout",
          "operation.type": "mutation",
        })
      ),
      Effect.tapError((error: unknown) =>
        Effect.annotateCurrentSpan({
          "error": true,
          "error.message": String(error),
        })
      )
    ) as any,

  Me: (payload) =>
    Effect.gen(function* () {
      yield* Effect.annotateCurrentSpan("rpc.method", "Me")
      yield* Effect.annotateCurrentSpan("operation.type", "query")
      
      // Verify access token from payload (transport portable)
      const tokenPayload = yield* Jwt.verifyAccessToken(payload.accessToken).pipe(
        Effect.tapError((error: unknown) =>
          Effect.annotateCurrentSpan({
            "auth.error": true,
            "auth.error_message": String(error),
          })
        )
      )
      
      yield* Effect.annotateCurrentSpan("auth.userId", tokenPayload.userId)
      yield* Effect.annotateCurrentSpan("auth.email", tokenPayload.email)
      
      return new UserSubject({
        userId: tokenPayload.userId,
        email: tokenPayload.email,
        name: tokenPayload.name,
      })
    }).pipe(
      Effect.withSpan("RPC.Me"),
      Effect.catchAll((error) =>
        Effect.fail(new UnauthenticatedError({ message: String(error) }))
      ),
      Effect.tapError((error: unknown) =>
        Effect.annotateCurrentSpan({
          "error": true,
          "error.message": error instanceof Error ? error.message : String(error),
          "error.type": "authentication",
        })
      )
    ),
})
