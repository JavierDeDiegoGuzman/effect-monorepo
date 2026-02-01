import { Effect, Layer } from "effect"
import { SignJWT, jwtVerify } from "jose"
import {
  UserSubject,
  TokenExpiredError,
  TokenInvalidError,
  PasswordError,
  type UserSubject as UserSubjectType,
} from "@effect-monorepo/contract"

// JWT Configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "your-secret-key-change-in-production"
)
const ACCESS_TOKEN_EXPIRY = "1h" // 1 hour
const REFRESH_TOKEN_EXPIRY = "7d" // 7 days

// Union type for JWT verification errors
type JwtVerifyError = TokenExpiredError | TokenInvalidError

export class JwtService extends Effect.Tag("JwtService")<
  JwtService,
  {
    readonly signAccessToken: (subject: UserSubjectType) => Effect.Effect<string, PasswordError>
    readonly signRefreshToken: (subject: UserSubjectType) => Effect.Effect<string, PasswordError>
    readonly verifyAccessToken: (token: string) => Effect.Effect<UserSubjectType, JwtVerifyError>
    readonly verifyRefreshToken: (token: string) => Effect.Effect<UserSubjectType, JwtVerifyError>
  }
>() {
  private static handleVerifyError(error: unknown): Effect.Effect<never, JwtVerifyError> {
    if (error instanceof Error && error.message.includes("expired")) {
      return Effect.fail(new TokenExpiredError({ message: "Token expired" }))
    }
    return Effect.fail(new TokenInvalidError({ message: "Invalid token" }))
  }

  static readonly Live = Layer.succeed(this, {
    signAccessToken: (subject: UserSubjectType) =>
      Effect.tryPromise(() =>
        new SignJWT({
          userId: subject.userId,
          email: subject.email,
          name: subject.name,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime(ACCESS_TOKEN_EXPIRY)
          .setSubject(subject.userId)
          .sign(JWT_SECRET)
      ).pipe(
        Effect.mapError((error) => new PasswordError({ reason: String(error) }))
      ),

    signRefreshToken: (subject: UserSubjectType) =>
      Effect.tryPromise(() =>
        new SignJWT({
          userId: subject.userId,
          email: subject.email,
          name: subject.name,
          type: "refresh",
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime(REFRESH_TOKEN_EXPIRY)
          .setSubject(subject.userId)
          .sign(JWT_SECRET)
      ).pipe(
        Effect.mapError((error) => new PasswordError({ reason: String(error) }))
      ),

    verifyAccessToken: (token: string) =>
      Effect.tryPromise(async () => {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return UserSubject.make({
          userId: payload.userId as string,
          email: payload.email as string,
          name: payload.name as string,
          iat: payload.iat,
          exp: payload.exp,
          sub: payload.sub,
        })
      }).pipe(
        Effect.catchAll((error) => JwtService.handleVerifyError(error))
      ),

    verifyRefreshToken: (token: string) =>
      Effect.tryPromise(async () => {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        // Verify it's a refresh token
        if (payload.type !== "refresh") {
          throw new Error("Not a refresh token")
        }
        return UserSubject.make({
          userId: payload.userId as string,
          email: payload.email as string,
          name: payload.name as string,
          iat: payload.iat,
          exp: payload.exp,
          sub: payload.sub,
        })
      }).pipe(
        Effect.catchAll((error) => JwtService.handleVerifyError(error))
      ),
  })
}
