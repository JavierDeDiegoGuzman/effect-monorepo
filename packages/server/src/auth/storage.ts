import { Effect, Layer, Ref } from "effect"
import { AuthUser } from "@effect-monorepo/contract"

// ============================================================================
// Types for refresh token storage
// ============================================================================

export interface RefreshTokenRecord {
  readonly token: string
  readonly userId: string
  readonly createdAt: number
  readonly revoked: boolean
}

// ============================================================================
// AuthStorage Service
// ============================================================================

export class AuthStorage extends Effect.Tag("AuthStorage")<
  AuthStorage,
  {
    readonly usersRef: Ref.Ref<Array<AuthUser>>
    readonly tokensRef: Ref.Ref<Array<RefreshTokenRecord>>
    readonly getUserByEmail: (email: string) => Effect.Effect<AuthUser | undefined>
    readonly getUserById: (id: string) => Effect.Effect<AuthUser | undefined>
    readonly createUser: (user: AuthUser) => Effect.Effect<void>
    readonly storeRefreshToken: (record: RefreshTokenRecord) => Effect.Effect<void>
    readonly getRefreshToken: (token: string) => Effect.Effect<RefreshTokenRecord | undefined>
    readonly revokeRefreshToken: (token: string) => Effect.Effect<void>
  }
>() {}

// ============================================================================
// Live Implementation
// ============================================================================

const makeAuthStorage = Effect.gen(function* () {
  const usersRef = yield* Ref.make<Array<AuthUser>>([])
  const tokensRef = yield* Ref.make<Array<RefreshTokenRecord>>([])

  const getUserByEmail = (email: string) =>
    Ref.get(usersRef).pipe(Effect.map((users) => users.find((u) => u.email === email)))

  const getUserById = (id: string) =>
    Ref.get(usersRef).pipe(Effect.map((users) => users.find((u) => u.id === id)))

  const createUser = (user: AuthUser) =>
    Ref.update(usersRef, (users) => [...users, user])

  const storeRefreshToken = (record: RefreshTokenRecord) =>
    Ref.update(tokensRef, (tokens) => [...tokens, record])

  const getRefreshToken = (token: string) =>
    Ref.get(tokensRef).pipe(
      Effect.map((tokens) => tokens.find((t) => t.token === token && !t.revoked))
    )

  const revokeRefreshToken = (token: string) =>
    Ref.update(tokensRef, (tokens) =>
      tokens.map((t) => (t.token === token ? { ...t, revoked: true } : t))
    )

  return {
    usersRef,
    tokensRef,
    getUserByEmail,
    getUserById,
    createUser,
    storeRefreshToken,
    getRefreshToken,
    revokeRefreshToken,
  }
})

export const AuthStorageLive = Layer.effect(AuthStorage, makeAuthStorage)
