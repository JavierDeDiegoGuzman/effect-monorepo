import { Effect, Layer, Ref } from "effect"
import type { AuthUser, RefreshTokenRecord } from "@effect-monorepo/contract"

// In-memory storage using Ref (same pattern as UsersStore)
export type AuthStorageState = {
  users: Array<AuthUser>
  refreshTokens: Array<RefreshTokenRecord>
}

export class AuthStorage extends Effect.Tag("AuthStorage")<
  AuthStorage,
  {
    readonly getUserByEmail: (email: string) => Effect.Effect<AuthUser | undefined, never>
    readonly getUserById: (id: string) => Effect.Effect<AuthUser | undefined, never>
    readonly createUser: (user: AuthUser) => Effect.Effect<void, never>
    readonly storeRefreshToken: (record: RefreshTokenRecord) => Effect.Effect<void, never>
    readonly getRefreshToken: (token: string) => Effect.Effect<RefreshTokenRecord | undefined, never>
    readonly revokeRefreshToken: (token: string) => Effect.Effect<void, never>
  }
>() {
  private static makeUsersStore() {
    return Effect.gen(function* () {
      const state = yield* Ref.make<AuthStorageState>({
        users: [],
        refreshTokens: [],
      })

      return {
        getUserByEmail: (email: string) =>
          Ref.get(state).pipe(
            Effect.map((s) => s.users.find((u) => u.email === email))
          ),

        getUserById: (id: string) =>
          Ref.get(state).pipe(
            Effect.map((s) => s.users.find((u) => u.id === id))
          ),

        createUser: (user: AuthUser) =>
          Ref.update(state, (s) => ({
            ...s,
            users: [...s.users, user],
          })),

        storeRefreshToken: (record: RefreshTokenRecord) =>
          Ref.update(state, (s) => ({
            ...s,
            refreshTokens: [...s.refreshTokens, record],
          })),

        getRefreshToken: (token: string) =>
          Ref.get(state).pipe(
            Effect.map((s) =>
              s.refreshTokens.find((t) => t.token === token && !t.revoked)
            )
          ),

        revokeRefreshToken: (token: string) =>
          Ref.update(state, (s) => ({
            ...s,
            refreshTokens: s.refreshTokens.map((t) =>
              t.token === token ? { ...t, revoked: true } : t
            ),
          })),
      }
    })
  }

  static readonly Live = Layer.effect(this, this.makeUsersStore())
}
