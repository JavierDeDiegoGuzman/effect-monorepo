import { Rpc, RpcGroup } from "@effect/rpc"
import { Schema } from "effect"

// User schema with business context (following "logging sucks" principles)
export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  // Business context fields for wide events
  createdAt: Schema.Number, // Unix timestamp
  subscription: Schema.optional(Schema.Literal("free", "premium", "enterprise")),
  lifetimeValueCents: Schema.optional(Schema.Number),
  lastSeenAt: Schema.optional(Schema.Number),
}) {}

// Event types for SSE - easily extensible
export class UserCreatedEvent extends Schema.Class<UserCreatedEvent>("UserCreatedEvent")({
  type: Schema.Literal("user.created"),
  user: User,
}) {}

export class UserUpdatedEvent extends Schema.Class<UserUpdatedEvent>("UserUpdatedEvent")({
  type: Schema.Literal("user.updated"),
  user: User,
}) {}

export class UserDeletedEvent extends Schema.Class<UserDeletedEvent>("UserDeletedEvent")({
  type: Schema.Literal("user.deleted"),
  userId: Schema.String,
}) {}

// Heartbeat event to keep HTTP streaming connections alive
// Similar to tRPC's ping mechanism
export class PingEvent extends Schema.Class<PingEvent>("PingEvent")({
  type: Schema.Literal("ping"),
  timestamp: Schema.Number,
}) {}

// Union type for all events - add new event types here
export const ServerEvent = Schema.Union(
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  PingEvent  // Add ping events for keep-alive
)
export type ServerEvent = Schema.Schema.Type<typeof ServerEvent>

// Create the RPC group with all procedures
export class UsersRpcs extends RpcGroup.make(
  Rpc.make("GetUsers", {
    success: Schema.Array(User),
    payload: {},
    error: Schema.Never,
  }),
  Rpc.make("GetUser", {
    success: User,
    payload: { id: Schema.String },
    error: Schema.String,
  }),
  Rpc.make("CreateUser", {
    success: User,
    payload: { name: Schema.String, email: Schema.String },
    error: Schema.String,
  }),
  Rpc.make("SubscribeEvents", {
    success: ServerEvent,
    payload: {},
    error: Schema.Never,
    stream: true  // CRITICAL: This makes it return a Stream
  })
) {}

// Export auth types and schemas
export * from "./auth.js"
