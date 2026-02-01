import { Effect, Layer, Context } from "effect"
import {
  UserSubject,
  Tokens,
  UnauthenticatedError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  TokenInvalidError,
  AuthUser,
  RefreshTokenRecord,
  type UserSubject as UserSubjectType,
} from "@effect-monorepo/contract"
import { PasswordService } from "./password.js"
import { JwtService } from "./jwt.js"
import { AuthStorage } from "./storage.js"

// Access token expiry in seconds
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600 // 1 hour

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15)

// Combined auth layer for all services
const AuthServicesLive = Layer.mergeAll(
  AuthStorage.Live,
  PasswordService.Live,
  JwtService.Live
)

// ============================================
// AuthService - Main authentication service
// ============================================
// Usage in handlers:
//   const currentUser = yield* AuthService  // Returns UserSubject or fails with UnauthenticatedError
//
// Static methods for auth operations:
//   AuthService.login(email, password)      // Returns Tokens
//   AuthService.register(name, email, password)  // Returns Tokens
//   AuthService.refresh(refreshToken)       // Returns { accessToken, expiresIn }
//   AuthService.logout(refreshToken)        // Returns void
//   AuthService.me(accessToken)             // Returns UserSubject

export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  UserSubjectType
>() {
  // ============================================
  // Static methods for authentication operations
  // ============================================

  static login(email: string, password: string) {
    return Effect.gen(function* () {
      const storage = yield* AuthStorage
      const passwordService = yield* PasswordService
      const jwtService = yield* JwtService

      // Find user by email
      const user = yield* storage.getUserByEmail(email)
      if (!user) {
        return yield* Effect.fail(new InvalidCredentialsError({ message: "Invalid email or password" }))
      }

      // Verify password
      const isValid = yield* passwordService.verify(password, user.passwordHash)
      if (!isValid) {
        return yield* Effect.fail(new InvalidCredentialsError({ message: "Invalid email or password" }))
      }

      // Create subject
      const subject = UserSubject.make({
        userId: user.id,
        email: user.email,
        name: user.name,
      })

      // Sign tokens
      const accessToken = yield* jwtService.signAccessToken(subject)
      const refreshToken = yield* jwtService.signRefreshToken(subject)

      // Store refresh token
      yield* storage.storeRefreshToken(
        new RefreshTokenRecord({
          token: refreshToken,
          userId: user.id,
          createdAt: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        })
      )

      return new Tokens({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      })
    }).pipe(Effect.provide(AuthServicesLive))
  }

  static register(name: string, email: string, password: string) {
    return Effect.gen(function* () {
      const storage = yield* AuthStorage
      const passwordService = yield* PasswordService
      const jwtService = yield* JwtService

      // Check if user already exists
      const existingUser = yield* storage.getUserByEmail(email)
      if (existingUser) {
        return yield* Effect.fail(new UserAlreadyExistsError({ email }))
      }

      // Hash password
      const passwordHash = yield* passwordService.hash(password)

      // Create user
      const user = new AuthUser({
        id: generateId(),
        email,
        name,
        passwordHash,
        createdAt: Date.now(),
      })
      yield* storage.createUser(user)

      // Create subject
      const subject = UserSubject.make({
        userId: user.id,
        email: user.email,
        name: user.name,
      })

      // Sign tokens
      const accessToken = yield* jwtService.signAccessToken(subject)
      const refreshToken = yield* jwtService.signRefreshToken(subject)

      // Store refresh token
      yield* storage.storeRefreshToken(
        new RefreshTokenRecord({
          token: refreshToken,
          userId: user.id,
          createdAt: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        })
      )

      return new Tokens({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      })
    }).pipe(Effect.provide(AuthServicesLive))
  }

  static refresh(refreshToken: string) {
    return Effect.gen(function* () {
      const storage = yield* AuthStorage
      const jwtService = yield* JwtService

      // Verify the refresh token
      const subject = yield* jwtService.verifyRefreshToken(refreshToken)

      // Check if token is revoked
      const tokenRecord = yield* storage.getRefreshToken(refreshToken)
      if (!tokenRecord) {
        return yield* Effect.fail(new TokenInvalidError({ message: "Refresh token not found or revoked" }))
      }

      // Issue new access token
      const accessToken = yield* jwtService.signAccessToken(subject)

      return {
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      }
    }).pipe(Effect.provide(AuthServicesLive))
  }

  static logout(refreshToken: string) {
    return Effect.gen(function* () {
      const storage = yield* AuthStorage
      yield* storage.revokeRefreshToken(refreshToken)
    }).pipe(Effect.provide(AuthStorage.Live))
  }

  static me(accessToken: string) {
    return Effect.gen(function* () {
      const jwtService = yield* JwtService
      const subject = yield* jwtService.verifyAccessToken(accessToken)
      return subject
    }).pipe(Effect.provide(JwtService.Live))
  }

  // ============================================
  // Live layer - extracts current user from request context
  // ============================================
  // This layer is used in protected RPC handlers
  // Usage: Effect.provide(AuthService.Live)

  static Live = Layer.effect(
    AuthService,
    Effect.gen(function* () {
      // In a real implementation, this would extract the Authorization header
      // from the current HTTP request context and verify the JWT
      // For now, we return a mock user or fail with UnauthenticatedError
      
      // TODO: Integrate with Effect HTTP context to extract Authorization header
      // This requires access to the HttpServerRequest from @effect/platform
      
      return yield* Effect.fail(
        new UnauthenticatedError({ message: "Authentication not yet integrated with HTTP context" })
      )
    })
  )
}
