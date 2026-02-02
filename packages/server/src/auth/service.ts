import { Effect, Layer } from "effect"
import { Context } from "effect"
import { AuthUser, InvalidCredentialsError, InvalidTokenError, 
         TokenExpiredError, UnauthenticatedError, UserAlreadyExistsError, 
         UserSubject } from "@effect-monorepo/contract"
import * as Password from "./password.js"
import * as Jwt from "./jwt.js"
import { AuthStorage, AuthStorageLive, RefreshTokenRecord } from "./storage.js"

// ============================================================================
// AuthService - Core authentication service
// ============================================================================

export class AuthService extends Context.Tag("AuthService")<AuthService, UserSubject>() {}

// ============================================================================
// Static Methods for Auth Operations
// ============================================================================

export const login = (email: string, password: string) =>
  Effect.gen(function* () {
    const storage = yield* AuthStorage
    
    // Find user by email
    const user = yield* storage.getUserByEmail(email)
    if (!user) {
      return yield* Effect.fail(new InvalidCredentialsError({ message: "Invalid email or password" }))
    }
    
    // Verify password
    const isValid = yield* Password.verify(password, user.passwordHash)
    if (!isValid) {
      return yield* Effect.fail(new InvalidCredentialsError({ message: "Invalid email or password" }))
    }
    
    // Create user subject
    const subject = new UserSubject({
      userId: user.id,
      email: user.email,
      name: user.name,
    })
    
    // Generate tokens
    const accessToken = yield* Jwt.signAccessToken(subject)
    const refreshToken = yield* Jwt.signRefreshToken(subject)
    
    // Store refresh token
    yield* storage.storeRefreshToken({
      token: refreshToken,
      userId: user.id,
      createdAt: Date.now(),
      revoked: false,
    })
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    }
  })  // Removed: .pipe(Effect.provide(AuthStorageLive))

export const register = (name: string, email: string, password: string) =>
  Effect.gen(function* () {
    const storage = yield* AuthStorage
    
    // Check if user already exists
    const existingUser = yield* storage.getUserByEmail(email)
    if (existingUser) {
      return yield* Effect.fail(new UserAlreadyExistsError({ 
        message: "User already exists with this email" 
      }))
    }
    
    // Hash password
    const passwordHash = yield* Password.hash(password)
    
    // Create new user
    const user: AuthUser = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      createdAt: Date.now(),
    }
    
    yield* storage.createUser(user)
    
    // Create user subject
    const subject = new UserSubject({
      userId: user.id,
      email: user.email,
      name: user.name,
    })
    
    // Generate tokens
    const accessToken = yield* Jwt.signAccessToken(subject)
    const refreshToken = yield* Jwt.signRefreshToken(subject)
    
    // Store refresh token
    yield* storage.storeRefreshToken({
      token: refreshToken,
      userId: user.id,
      createdAt: Date.now(),
      revoked: false,
    })
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    }
  })  // Removed: .pipe(Effect.provide(AuthStorageLive))

export const refresh = (refreshToken: string) =>
  Effect.gen(function* () {
    const storage = yield* AuthStorage
    
    // Verify the refresh token
    const payload = yield* Jwt.verifyRefreshToken(refreshToken)
    
    // Check if token is revoked
    const tokenRecord = yield* storage.getRefreshToken(refreshToken)
    if (!tokenRecord) {
      return yield* Effect.fail(new InvalidTokenError({ message: "Refresh token has been revoked" }))
    }
    
    // Get user
    const user = yield* storage.getUserById(payload.userId)
    if (!user) {
      return yield* Effect.fail(new InvalidTokenError({ message: "User not found" }))
    }
    
    // Create user subject
    const subject = new UserSubject({
      userId: user.id,
      email: user.email,
      name: user.name,
    })
    
    // Generate new access token
    const accessToken = yield* Jwt.signAccessToken(subject)
    
    return {
      accessToken,
      expiresIn: 3600, // 1 hour in seconds
    }
  })  // Removed: .pipe(Effect.provide(AuthStorageLive))

export const logout = (refreshToken: string) =>
  Effect.gen(function* () {
    const storage = yield* AuthStorage
    
    // Verify the refresh token first
    yield* Jwt.verifyRefreshToken(refreshToken)
    
    // Revoke the token
    yield* storage.revokeRefreshToken(refreshToken)
    
    return undefined
  })  // Removed: .pipe(Effect.provide(AuthStorageLive))

// ============================================================================
// AuthService Live Layer - Extracts UserSubject from request context
// ============================================================================

// This will be implemented in handlers.ts to extract JWT from RPC request headers
export const AuthServiceLive = (getAuthHeader: () => string | undefined) =>
  Layer.effect(
    AuthService,
    Effect.gen(function* () {
      const authHeader = getAuthHeader()
      const token = Jwt.extractBearerToken(authHeader)
      
      if (!token) {
        return yield* Effect.fail(new UnauthenticatedError({ message: "No authorization token provided" }))
      }
      
      const payload = yield* Jwt.verifyAccessToken(token)
      
      return new UserSubject({
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
      })
    })
  )
