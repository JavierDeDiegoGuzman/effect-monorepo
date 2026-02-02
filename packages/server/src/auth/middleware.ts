import { Effect, Layer, Context } from "effect"
import { UserSubject, UnauthenticatedError } from "@effect-monorepo/contract"
import * as Jwt from "./jwt.js"

// Context tag for the current authenticated user
export const CurrentUser = Context.GenericTag<UserSubject>("@effect-monorepo/server/CurrentUser")

// Extract Bearer token from Authorization header
const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  return authHeader.slice(7)
}

// Auth middleware implementation for server
export const AuthMiddlewareLive = (authHeader: string | undefined) =>
  Layer.effect(
    CurrentUser,
    Effect.gen(function* () {
      const token = extractBearerToken(authHeader)
      
      if (!token) {
        return yield* Effect.fail(
          new UnauthenticatedError({ message: "No authorization token provided" })
        )
      }
      
      const payload = yield* Jwt.verifyAccessToken(token)
      
      return new UserSubject({
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
      })
    })
  )
