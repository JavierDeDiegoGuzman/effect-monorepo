import { Rpc, RpcGroup, RpcMiddleware } from "@effect/rpc"
import { Schema } from "effect"

// ============================================================================
// Auth User - User data stored for authentication (includes password hash)
// ============================================================================

export class AuthUser extends Schema.Class<AuthUser>("AuthUser")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  passwordHash: Schema.String,
  createdAt: Schema.Number,
}) {}

// ============================================================================
// UserSubject - JWT payload containing authenticated user info
// ============================================================================

export class UserSubject extends Schema.Class<UserSubject>("UserSubject")({
  userId: Schema.String,
  email: Schema.String,
  name: Schema.String,
}) {}

// ============================================================================
// Tokens - Response from login/register containing access and refresh tokens
// ============================================================================

export class Tokens extends Schema.Class<Tokens>("Tokens")({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  expiresIn: Schema.Number, // seconds until access token expires
}) {}

// ============================================================================
// Error Types - Tagged errors for type-safe error handling
// ============================================================================

export class UnauthenticatedError extends Schema.TaggedError<UnauthenticatedError>(
  "UnauthenticatedError"
)("UnauthenticatedError", {
  message: Schema.String,
}) {}

export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>(
  "InvalidCredentialsError"
)("InvalidCredentialsError", {
  message: Schema.String,
}) {}

export class UserAlreadyExistsError extends Schema.TaggedError<UserAlreadyExistsError>(
  "UserAlreadyExistsError"
)("UserAlreadyExistsError", {
  message: Schema.String,
}) {}

export class TokenExpiredError extends Schema.TaggedError<TokenExpiredError>(
  "TokenExpiredError"
)("TokenExpiredError", {
  message: Schema.String,
}) {}

export class InvalidTokenError extends Schema.TaggedError<InvalidTokenError>(
  "InvalidTokenError"
)("InvalidTokenError", {
  message: Schema.String,
}) {}

// ============================================================================
// Payload Schemas - Input validation for auth operations
// ============================================================================

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(8)),
}) {}

export class RegisterPayload extends Schema.Class<RegisterPayload>("RegisterPayload")({
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(8)),
}) {}

export class RefreshPayload extends Schema.Class<RefreshPayload>("RefreshPayload")({
  refreshToken: Schema.String,
}) {}

export class MePayload extends Schema.Class<MePayload>("MePayload")({
  accessToken: Schema.String,  // Client sends access token in payload (transport portable)
}) {}

// ============================================================================
// Auth RPC Group - All authentication procedures
// ============================================================================

export class AuthRpcs extends RpcGroup.make(
  Rpc.make("Login", {
    success: Tokens,
    payload: LoginPayload,
    error: Schema.Union(InvalidCredentialsError, Schema.String),
  }),
  Rpc.make("Register", {
    success: Tokens,
    payload: RegisterPayload,
    error: Schema.Union(UserAlreadyExistsError, Schema.String),
  }),
  Rpc.make("Refresh", {
    success: Schema.Struct({
      accessToken: Schema.String,
      expiresIn: Schema.Number,
    }),
    payload: RefreshPayload,
    error: Schema.Union(TokenExpiredError, InvalidTokenError, Schema.String),
  }),
  Rpc.make("Logout", {
    success: Schema.Void,
    payload: RefreshPayload,
    error: Schema.Union(InvalidTokenError, Schema.String),
  }),
  Rpc.make("Me", {
    success: UserSubject,
    payload: MePayload,
    error: Schema.Union(UnauthenticatedError, Schema.String),
  })
) {}
