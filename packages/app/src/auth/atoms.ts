import { Atom, AtomRpc } from "@effect-atom/atom-react"
import { FetchHttpClient } from "@effect/platform"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { Layer } from "effect"
import { AuthRpcs, Tokens, UserSubject } from "@effect-monorepo/contract"

// ============================================================================
// Auth RPC Client
// ============================================================================

export class AuthClient extends AtomRpc.Tag<AuthClient>()("AuthClient", {
  group: AuthRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: "http://localhost:3000/rpc/auth"
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson)  // Fixed: Changed from layerJson to layerNdjson to match server
  )
}) {}

// ============================================================================
// Token Storage
// ============================================================================

const TOKEN_KEY = "auth_tokens"

export const getStoredTokens = (): Tokens | null => {
  const stored = localStorage.getItem(TOKEN_KEY)
  return stored ? JSON.parse(stored) : null
}

export const setStoredTokens = (tokens: Tokens) => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

export const clearStoredTokens = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export const getAccessToken = (): string | null => {
  return getStoredTokens()?.accessToken ?? null
}

export const getRefreshToken = (): string | null => {
  return getStoredTokens()?.refreshToken ?? null
}

// ============================================================================
// Auth State Atom
// ============================================================================

export interface AuthState {
  isAuthenticated: boolean
  user: UserSubject | null
  accessToken: string | null
}

export const authStateAtom = Atom.make<AuthState>({
  isAuthenticated: false,
  user: null,
  accessToken: null
}).pipe(Atom.keepAlive)

// ============================================================================
// Auth Mutations
// ============================================================================

export const loginAtom = AuthClient.mutation("Login")
export const registerAtom = AuthClient.mutation("Register")
export const refreshAtom = AuthClient.mutation("Refresh")
export const logoutAtom = AuthClient.mutation("Logout")
export const meAtom = AuthClient.mutation("Me")
