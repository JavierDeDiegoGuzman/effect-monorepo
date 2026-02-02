import * as jose from "jose"
import { Effect } from "effect"
import { UserSubject } from "@effect-monorepo/contract"
import { InvalidTokenError, TokenExpiredError } from "@effect-monorepo/contract"

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"
const ACCESS_TOKEN_EXPIRY = "1h"
const REFRESH_TOKEN_EXPIRY = "7d"

const secret = new TextEncoder().encode(JWT_SECRET)

// Token types
export interface AccessTokenPayload extends jose.JWTPayload {
  readonly userId: string
  readonly email: string
  readonly name: string
  readonly type: "access"
}

export interface RefreshTokenPayload extends jose.JWTPayload {
  readonly userId: string
  readonly email: string
  readonly name: string
  readonly type: "refresh"
}

export const signAccessToken = (user: UserSubject): Effect.Effect<string, never> =>
  Effect.tryPromise(() =>
    new jose.SignJWT({
      userId: user.userId,
      email: user.email,
      name: user.name,
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(secret)
  ).pipe(Effect.orDie)

export const signRefreshToken = (user: UserSubject): Effect.Effect<string, never> =>
  Effect.tryPromise(() =>
    new jose.SignJWT({
      userId: user.userId,
      email: user.email,
      name: user.name,
      type: "refresh",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(secret)
  ).pipe(Effect.orDie)

export const verifyAccessToken = (token: string): Effect.Effect<AccessTokenPayload, TokenExpiredError | InvalidTokenError> =>
  Effect.tryPromise(() =>
    jose.jwtVerify(token, secret) as Promise<jose.JWTVerifyResult<AccessTokenPayload>>
  ).pipe(
    Effect.map((result) => result.payload),
    Effect.catchAll((error) =>
      error instanceof jose.errors.JWTExpired
        ? Effect.fail<TokenExpiredError | InvalidTokenError>(new TokenExpiredError({ message: "Access token has expired" }))
        : Effect.fail<TokenExpiredError | InvalidTokenError>(new InvalidTokenError({ message: "Invalid access token" }))
    )
  )

export const verifyRefreshToken = (token: string): Effect.Effect<RefreshTokenPayload, TokenExpiredError | InvalidTokenError> =>
  Effect.tryPromise(() =>
    jose.jwtVerify(token, secret) as Promise<jose.JWTVerifyResult<RefreshTokenPayload>>
  ).pipe(
    Effect.map((result) => result.payload),
    Effect.catchAll((error) =>
      error instanceof jose.errors.JWTExpired
        ? Effect.fail<TokenExpiredError | InvalidTokenError>(new TokenExpiredError({ message: "Refresh token has expired" }))
        : Effect.fail<TokenExpiredError | InvalidTokenError>(new InvalidTokenError({ message: "Invalid refresh token" }))
    )
  )

export const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  return authHeader.slice(7)
}
