import { useState, FormEvent } from "react"
import { useAtomValue, useAtomSet, useAtom, Result } from "@effect-atom/atom-react"
import { Exit, Cause } from "effect"
import type { User, ServerEvent } from "@effect-monorepo/contract"
import { 
  usersAtom, 
  nameAtom, 
  emailAtom, 
  createUserAtom,
  latestEventAtom
} from "./atoms.js"

function App() {
  const usersResult = useAtomValue(usersAtom)
  const [name, setName] = useAtom(nameAtom)
  const [email, setEmail] = useAtom(emailAtom)
  const createUser = useAtomSet(createUserAtom, { mode: "promiseExit" })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // ✅ NEW: Subscribe to the latest event stream (no manual polling needed)
  // The stream is handled automatically by the atom
  const latestEventResult = useAtomValue(latestEventAtom)

  // Handle form submission
  const handleCreateUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !email) return

    setCreating(true)
    setError(null)

    // Use mutation with reactivity keys to auto-refresh users list
    const exit = await createUser({
      payload: { name, email },
      reactivityKeys: ["users"] // This will invalidate and refresh the users query
    })

    if (Exit.isSuccess(exit)) {
      setName("")
      setEmail("")
    } else {
      setError(Cause.pretty(exit.cause))
    }

    setCreating(false)
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Effect RPC + React Demo with Streaming</h1>

      {/* Stream connection status indicator */}
      {Result.match(latestEventResult, {
        onInitial: () => (
          <div style={{
            padding: "0.5rem 1rem",
            background: "#fff3cd",
            color: "#856404",
            borderRadius: "4px",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            fontWeight: "bold"
          }}>
            🔄 Connecting to event stream...
          </div>
        ),
        onSuccess: (event) => (
          <div style={{
            padding: "0.5rem 1rem",
            background: "#d4edda",
            color: "#155724",
            borderRadius: "4px",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            fontWeight: "bold"
          }}>
            ✅ Stream connected - Latest: {
              event.value.type === "user.created" ? `Created: ${event.value.user.name}` :
              event.value.type === "user.updated" ? `Updated: ${event.value.user.name}` :
              event.value.type === "user.deleted" ? `Deleted: ${event.value.userId}` :
              "Unknown event"
            }
          </div>
        ),
        onFailure: (failure) => (
          <div style={{
            padding: "0.5rem 1rem",
            background: "#f8d7da",
            color: "#721c24",
            borderRadius: "4px",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            fontWeight: "bold"
          }}>
            ❌ Stream error: {Cause.pretty(failure.cause)}
          </div>
        )
      })}

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "#fee",
            color: "#c00",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: "2rem" }}>
        <h2>Create User</h2>
        <form onSubmit={handleCreateUser}>
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              disabled={creating}
              style={{ padding: "0.5rem", width: "100%", marginBottom: "0.5rem" }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              disabled={creating}
              style={{ padding: "0.5rem", width: "100%" }}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !name || !email}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      <div>
        <h2>Users</h2>
        {Result.match(usersResult, {
          onInitial: () => <p>Loading users...</p>,
          onSuccess: (success) => {
            const users = success.value as readonly User[]
            return (
              <div>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {users.map((user: User) => (
                    <li
                      key={user.id}
                      style={{
                        padding: "1rem",
                        background: "#f5f5f5",
                        marginBottom: "0.5rem",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>{user.name}</strong> - {user.email}
                    </li>
                  ))}
                </ul>
              </div>
            )
          },
          onFailure: (failure) => (
            <div style={{ color: "#c00" }}>Error loading users: {Cause.pretty(failure.cause)}</div>
          ),
        })}
      </div>
    </div>
  )
}

export default App
