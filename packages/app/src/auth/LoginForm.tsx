import { useState, FormEvent } from "react"
import { useAtomSet, useAtom } from "@effect-atom/atom-react"
import { Exit, Cause } from "effect"
import type { Tokens } from "@effect-monorepo/contract"
import { 
  loginAtom, 
  registerAtom, 
  authStateAtom, 
  setStoredTokens,
  type AuthState 
} from "./atoms.js"

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const setAuth = useAtomSet(authStateAtom)
  const login = useAtomSet(loginAtom, { mode: "promiseExit" })
  const register = useAtomSet(registerAtom, { mode: "promiseExit" })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const exit: any = isLogin
      ? await login({ payload: { email, password } })
      : await register({ payload: { name, email, password } })

    if (Exit.isSuccess(exit)) {
      const tokens = exit.value as Tokens
      setStoredTokens(tokens)
      setAuth({
        isAuthenticated: true,
        accessToken: tokens.accessToken,
        user: null // Will be populated by calling Me endpoint
      } as AuthState)
      onSuccess?.()
    } else {
      setError(Cause.pretty((exit as any).cause))
    }

    setLoading(false)
  }

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
      <h2>{isLogin ? "Login" : "Register"}</h2>
      
      {error && (
        <div style={{
          padding: "1rem",
          background: "#fee",
          color: "#c00",
          borderRadius: "4px",
          marginBottom: "1rem"
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              disabled={loading}
              style={{ padding: "0.5rem", width: "100%" }}
              required
            />
          </div>
        )}
        
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            disabled={loading}
            style={{ padding: "0.5rem", width: "100%" }}
            required
          />
        </div>
        
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            disabled={loading}
            style={{ padding: "0.5rem", width: "100%" }}
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password || (!isLogin && !name)}
          style={{ 
            padding: "0.5rem 1rem", 
            cursor: "pointer",
            width: "100%",
            marginBottom: "1rem"
          }}
        >
          {loading ? (isLogin ? "Logging in..." : "Registering...") : (isLogin ? "Login" : "Register")}
        </button>
      </form>

      <button
        onClick={() => {
          setIsLogin(!isLogin)
          setError(null)
        }}
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          cursor: "pointer",
          width: "100%",
          background: "transparent",
          border: "1px solid #ccc"
        }}
      >
        {isLogin ? "Need an account? Register" : "Already have an account? Login"}
      </button>
    </div>
  )
}
