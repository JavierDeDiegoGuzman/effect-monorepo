#!/usr/bin/env bun
import { NodeRuntime } from "@effect/platform-node"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { FetchHttpClient } from "@effect/platform"
import { UsersRpcs, AuthRpcs } from "@effect-monorepo/contract"
import { Effect, Layer, Console } from "effect"

// ============================================================================
// RPC Protocol Layers - Matching server config
// ============================================================================

const UsersProtocol = RpcClient.layerProtocolHttp({
  url: "http://localhost:3000/rpc/users"
}).pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerNdjson)
)

const AuthProtocol = RpcClient.layerProtocolHttp({
  url: "http://localhost:3000/rpc/auth"
}).pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerNdjson)
)

// ============================================================================
// AUTH COMMANDS
// ============================================================================

const registerUser = (name: string, email: string, password: string) =>
  Effect.gen(function* () {
    yield* Console.log(`📝 Registering: ${name} (${email})...`)
    
    const client = yield* RpcClient.make(AuthRpcs)
    const tokens = yield* client.Register({ name, email, password })
    
    yield* Console.log("\n✅ Registration successful!")
    yield* Console.log(`   Access Token: ${tokens.accessToken}`)
    yield* Console.log(`   Refresh Token: ${tokens.refreshToken}`)
    yield* Console.log(`   Expires in: ${tokens.expiresIn}s\n`)
    yield* Console.log("💡 Copy the access token to create users!")
    
    return tokens.accessToken
  }).pipe(
    Effect.scoped,
    Effect.provide(AuthProtocol),
    Effect.catchAll((error) => 
      Console.log(`\n❌ Error: ${JSON.stringify(error, null, 2)}\n`).pipe(
        Effect.flatMap(() => Effect.fail("Registration failed"))
      )
    )
  )

const login = (email: string, password: string) =>
  Effect.gen(function* () {
    yield* Console.log(`🔐 Logging in: ${email}...`)
    
    const client = yield* RpcClient.make(AuthRpcs)
    const tokens = yield* client.Login({ email, password })
    
    yield* Console.log("\n✅ Login successful!")
    yield* Console.log(`   Access Token: ${tokens.accessToken}`)
    yield* Console.log(`   Refresh Token: ${tokens.refreshToken}`)
    yield* Console.log(`   Expires in: ${tokens.expiresIn}s\n`)
    yield* Console.log("💡 Copy the access token to create users!")
    
    return tokens.accessToken
  }).pipe(
    Effect.scoped,
    Effect.provide(AuthProtocol),
    Effect.catchAll((error) => 
      Console.log(`\n❌ Error: ${JSON.stringify(error, null, 2)}\n`).pipe(
        Effect.flatMap(() => Effect.fail("Login failed"))
      )
    )
  )

// ============================================================================
// USER COMMANDS
// ============================================================================

const listUsers = Effect.gen(function* () {
  yield* Console.log("📋 Fetching users...")
  
  const client = yield* RpcClient.make(UsersRpcs)
  const users = yield* client.GetUsers({})
  
  yield* Console.log(`\n✅ Found ${users.length} users:\n`)
  
  for (const user of users) {
    yield* Console.log(`  👤 ${user.name} (${user.email})`)
    yield* Console.log(`     ID: ${user.id}`)
    yield* Console.log(`     Created: ${new Date(user.createdAt).toISOString()}`)
    if (user.subscription) {
      yield* Console.log(`     Subscription: ${user.subscription}`)
    }
    yield* Console.log("")
  }
}).pipe(
  Effect.scoped,
  Effect.provide(UsersProtocol),
  Effect.catchAll((error) => 
    Console.log(`\n❌ Error: ${JSON.stringify(error, null, 2)}\n`)
  )
)

const createUser = (name: string, email: string, accessToken: string) => 
  Effect.gen(function* () {
    yield* Console.log(`📝 Creating user: ${name} (${email})...`)
    
    const client = yield* RpcClient.make(UsersRpcs)
    const user = yield* client.CreateUser({ name, email, accessToken })
    
    yield* Console.log("\n✅ User created!")
    yield* Console.log(`   ID: ${user.id}`)
    yield* Console.log(`   Name: ${user.name}`)
    yield* Console.log(`   Email: ${user.email}`)
    yield* Console.log(`   Created: ${new Date(user.createdAt).toISOString()}\n`)
  }).pipe(
    Effect.scoped,
    Effect.provide(UsersProtocol),
    Effect.catchAll((error) => 
      Console.log(`\n❌ Error: ${JSON.stringify(error, null, 2)}\n`)
    )
  )

const getUser = (id: string) => 
  Effect.gen(function* () {
    yield* Console.log(`🔍 Fetching user ID: ${id}...`)
    
    const client = yield* RpcClient.make(UsersRpcs)
    const user = yield* client.GetUser({ id })
    
    yield* Console.log("\n✅ User found!")
    yield* Console.log(`   Name: ${user.name}`)
    yield* Console.log(`   Email: ${user.email}`)
    yield* Console.log(`   Created: ${new Date(user.createdAt).toISOString()}`)
    if (user.subscription) {
      yield* Console.log(`   Subscription: ${user.subscription}`)
    }
    yield* Console.log("")
  }).pipe(
    Effect.scoped,
    Effect.provide(UsersProtocol),
    Effect.catchAll((error) => 
      Console.log(`\n❌ Error: ${JSON.stringify(error, null, 2)}\n`)
    )
  )

// ============================================================================
// FULL WORKFLOW TEST - Register -> Create User -> Logout -> Login
// ============================================================================

const testWorkflow = Effect.gen(function* () {
  yield* Console.log("🧪 Starting full workflow test...\n")
  yield* Console.log("=" .repeat(60) + "\n")
  
  // Step 1: Register
  yield* Console.log("STEP 1: Register new user")
  yield* Console.log("-" .repeat(60))
  const token1 = yield* registerUser("Test User", "test@workflow.com", "password123")
  
  yield* Console.log("\n" + "=" .repeat(60) + "\n")
  
  // Step 2: Create another user with the token
  yield* Console.log("STEP 2: Create another user with the token")
  yield* Console.log("-" .repeat(60))
  yield* createUser("Created User", "created@workflow.com", token1)
  
  yield* Console.log("=" .repeat(60) + "\n")
  
  // Step 3: List all users
  yield* Console.log("STEP 3: List all users")
  yield* Console.log("-" .repeat(60))
  yield* listUsers
  
  yield* Console.log("=" .repeat(60) + "\n")
  
  // Step 4: Logout (simulated by just not using the token)
  yield* Console.log("STEP 4: Logout (token discarded)")
  yield* Console.log("-" .repeat(60))
  yield* Console.log("✅ Logged out (token is no longer being used)\n")
  
  yield* Console.log("=" .repeat(60) + "\n")
  
  // Step 5: Login again
  yield* Console.log("STEP 5: Login again with same credentials")
  yield* Console.log("-" .repeat(60))
  const token2 = yield* login("test@workflow.com", "password123")
  
  yield* Console.log("=" .repeat(60) + "\n")
  
  // Step 6: Verify we can use the new token
  yield* Console.log("STEP 6: Create another user with new token")
  yield* Console.log("-" .repeat(60))
  yield* createUser("After Login User", "afterlogin@workflow.com", token2)
  
  yield* Console.log("=" .repeat(60) + "\n")
  yield* Console.log("✅ Full workflow test completed successfully!")
})

// ============================================================================
// CLI Parser
// ============================================================================

const args = process.argv.slice(2)
const command = args[0]

const program = Effect.gen(function* () {
  if (!command || command === "help" || command === "--help") {
    yield* Console.log(`
📦 Effect RPC CLI Tool

Usage:
  bun packages/cli/src/index.ts <command> [args]

Auth Commands:
  register <name> <email> <password>   Register new account
  login <email> <password>             Login to get access token

User Commands:
  list                                 List all users
  create <name> <email> <token>        Create user (needs token from login/register)
  get <id>                             Get user by ID

Special Commands:
  test-workflow                        Run full registration -> create -> logout -> login workflow
  help                                 Show this help

Examples:
  bun packages/cli/src/index.ts register "John Doe" "john@test.com" "password123"
  bun packages/cli/src/index.ts login "john@test.com" "password123"
  bun packages/cli/src/index.ts list
  bun packages/cli/src/index.ts create "Jane Doe" "jane@test.com" "eyJhbGc..."
  bun packages/cli/src/index.ts get "1"
  bun packages/cli/src/index.ts test-workflow
`)
    return
  }

  switch (command) {
    case "test-workflow":
      yield* testWorkflow
      break
      
    case "register":
      const regName = args[1]
      const regEmail = args[2]
      const regPassword = args[3]
      
      if (!regName || !regEmail || !regPassword) {
        yield* Console.log("❌ Error: register requires <name> <email> <password>")
        return
      }
      
      yield* registerUser(regName, regEmail, regPassword)
      break
    
    case "login":
      const loginEmail = args[1]
      const loginPassword = args[2]
      
      if (!loginEmail || !loginPassword) {
        yield* Console.log("❌ Error: login requires <email> <password>")
        return
      }
      
      yield* login(loginEmail, loginPassword)
      break
    
    case "list":
      yield* listUsers
      break
    
    case "create":
      const name = args[1]
      const email = args[2]
      const token = args[3]
      
      if (!name || !email || !token) {
        yield* Console.log("❌ Error: create requires <name> <email> <token>")
        yield* Console.log("💡 Get a token by running: bun packages/cli/src/index.ts login <email> <password>")
        return
      }
      
      yield* createUser(name, email, token)
      break
    
    case "get":
      const id = args[1]
      
      if (!id) {
        yield* Console.log("❌ Error: get requires <id>")
        return
      }
      
      yield* getUser(id)
      break
    
    default:
      yield* Console.log(`❌ Unknown command: ${command}`)
      yield* Console.log('Run "bun packages/cli/src/index.ts help" for usage')
  }
})

NodeRuntime.runMain(program)
