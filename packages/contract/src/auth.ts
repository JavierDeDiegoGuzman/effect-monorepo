import { Schema } from "effect"

// ============================================
// JWT & Token Types
// ============================================

export class UserSubject extends Schema.Class<UserSubject>("UserSubject")({
  userId: Schema.String,
  email: Schema.String,
  name: Schema.String,
  // Standard JWT claims
  iat: Schema.optional(Schema.Number),
  exp: Schema.optional(Schema.Number),
  sub: Schema.optional(Schema.String),
}) {}

export class Tokens extends Schema.Class<Tokens>("Tokens")({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  expiresIn: Schema.Number, // seconds
}) {}

// ============================================
// Auth Request Payloads
// ============================================

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(6)),
}) {}

export class RegisterPayload extends Schema.Class<RegisterPayload>("RegisterPayload")({
  name: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(100)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(6)),
}) {}

export class RefreshPayload extends Schema.Class<RefreshPayload>("RefreshPayload")({
  refreshToken: Schema.String,
}) {}

export class ForgotPasswordPayload extends Schema.Class<ForgotPasswordPayload>("ForgotPasswordPayload")({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
}) {}

// ============================================
// Auth Errors (Tagged for type-safe handling)
// ============================================

export class UnauthenticatedError extends Schema.TaggedError<UnauthenticatedError>("UnauthenticatedError")(
  "UnauthenticatedError",
  { message: Schema.optional(Schema.String) }
) {}

export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>("InvalidCredentialsError")(
  "InvalidCredentialsError",
  { message: Schema.optional(Schema.String) }
) {}

export class UserAlreadyExistsError extends Schema.TaggedError<UserAlreadyExistsError>("UserAlreadyExistsError")(
  "UserAlreadyExistsError",
  { email: Schema.String }
) {}

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>("UserNotFoundError")(
  "UserNotFoundError",
  { email: Schema.String }
) {}

export class TokenExpiredError extends Schema.TaggedError<TokenExpiredError>("TokenExpiredError")(
  "TokenExpiredError",
  { message: Schema.optional(Schema.String) }
) {}

export class TokenInvalidError extends Schema.TaggedError<TokenInvalidError>("TokenInvalidError")(
  "TokenInvalidError",
  { message: Schema.optional(Schema.String) }
) {}

export class PasswordError extends Schema.TaggedError<PasswordError>("PasswordError")(
  "PasswordError",
  { reason: Schema.String }
) {}

// Union of all auth errors for convenience
export const AuthError = Schema.Union(
  UnauthenticatedError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  UserNotFoundError,
  TokenExpiredError,
  TokenInvalidError
)
export type AuthError = Schema.Schema.Type<typeof AuthError>

// ============================================
// Auth User (stored in AuthStorage)
// ============================================

export class AuthUser extends Schema.Class<AuthUser>("AuthUser")({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
  passwordHash: Schema.String,
  createdAt: Schema.Number,
}) {}

export class RefreshTokenRecord extends Schema.Class<RefreshTokenRecord>("RefreshTokenRecord")({
  token: Schema.String,
  userId: Schema.String,
  createdAt: Schema.Number,
  expiresAt: Schema.Number,
  revoked: Schema.optional(Schema.Boolean),
}) {}
