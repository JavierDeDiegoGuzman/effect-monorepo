import { HttpRouter, HttpServerResponse, HttpServerRequest } from "@effect/platform"
import { Effect } from "effect"
import {
  LoginPayload,
  RegisterPayload,
  RefreshPayload,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  TokenExpiredError,
  TokenInvalidError,
} from "@effect-monorepo/contract"
import { AuthService } from "./service.js"

// Auth routes using Effect Platform HttpRouter
export const AuthRouter = HttpRouter.empty.pipe(
  // POST /auth/login - Authenticate user and return tokens
  HttpRouter.post("/auth/login", Effect.gen(function* () {
    const body = yield* HttpRouter.schemaJson(LoginPayload)
    
    return yield* AuthService.login(body.email, body.password).pipe(
      Effect.matchEffect({
        onSuccess: (tokens) => Effect.succeed(HttpServerResponse.json(tokens)),
        onFailure: (error) => {
          if (error instanceof InvalidCredentialsError) {
            return Effect.succeed(HttpServerResponse.json({ error: "Invalid credentials" }, { status: 401 }))
          }
          console.error("Login error:", error)
          return Effect.succeed(HttpServerResponse.json({ error: "Internal server error" }, { status: 500 }))
        }
      })
    )
  })),

  // POST /auth/register - Register new user and return tokens
  HttpRouter.post("/auth/register", Effect.gen(function* () {
    const body = yield* HttpRouter.schemaJson(RegisterPayload)
    
    return yield* AuthService.register(body.name, body.email, body.password).pipe(
      Effect.matchEffect({
        onSuccess: (tokens) => Effect.succeed(HttpServerResponse.json(tokens, { status: 201 })),
        onFailure: (error) => {
          if (error instanceof UserAlreadyExistsError) {
            return Effect.succeed(HttpServerResponse.json({ error: "User already exists" }, { status: 409 }))
          }
          console.error("Register error:", error)
          return Effect.succeed(HttpServerResponse.json({ error: "Internal server error" }, { status: 500 }))
        }
      })
    )
  })),

  // POST /auth/refresh - Refresh access token using refresh token
  HttpRouter.post("/auth/refresh", Effect.gen(function* () {
    const body = yield* HttpRouter.schemaJson(RefreshPayload)
    
    return yield* AuthService.refresh(body.refreshToken).pipe(
      Effect.matchEffect({
        onSuccess: (response) => Effect.succeed(HttpServerResponse.json(response)),
        onFailure: (error) => {
          if (error instanceof TokenExpiredError || error instanceof TokenInvalidError) {
            return Effect.succeed(HttpServerResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 }))
          }
          console.error("Refresh error:", error)
          return Effect.succeed(HttpServerResponse.json({ error: "Internal server error" }, { status: 500 }))
        }
      })
    )
  })),

  // POST /auth/logout - Revoke refresh token
  HttpRouter.post("/auth/logout", Effect.gen(function* () {
    const body = yield* HttpRouter.schemaJson(RefreshPayload)
    
    yield* AuthService.logout(body.refreshToken)
    
    return HttpServerResponse.json({ success: true })
  })),

  // GET /auth/me - Get current user info from access token
  HttpRouter.get("/auth/me", Effect.gen(function* () {
    // Access the HTTP request to get headers
    const request = yield* HttpServerRequest.HttpServerRequest
    const authHeader = request.headers["authorization"]
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpServerResponse.json(
        { error: "Missing or invalid authorization header" }, 
        { status: 401 }
      )
    }
    
    const token = authHeader.slice(7) // Remove "Bearer " prefix
    
    return yield* AuthService.me(token).pipe(
      Effect.matchEffect({
        onSuccess: (user) => Effect.succeed(HttpServerResponse.json(user)),
        onFailure: (error) => {
          if (error instanceof TokenExpiredError) {
            return Effect.succeed(HttpServerResponse.json({ error: "Token expired" }, { status: 401 }))
          }
          if (error instanceof TokenInvalidError) {
            return Effect.succeed(HttpServerResponse.json({ error: "Invalid token" }, { status: 401 }))
          }
          return Effect.succeed(HttpServerResponse.json({ error: "Internal server error" }, { status: 500 }))
        }
      })
    )
  }))
)
