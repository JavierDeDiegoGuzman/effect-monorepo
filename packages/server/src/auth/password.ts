import { Effect } from "effect"

export class PasswordError {
  readonly _tag = "PasswordError"
  constructor(readonly reason: string) {}
}

export const hash = (password: string): Effect.Effect<string, PasswordError> =>
  Effect.tryPromise(() =>
    Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 })
  ).pipe(
    Effect.mapError((error) => new PasswordError(String(error)))
  )

export const verify = (password: string, hash: string): Effect.Effect<boolean, PasswordError> =>
  Effect.tryPromise(() =>
    Bun.password.verify(password, hash)
  ).pipe(
    Effect.mapError((error) => new PasswordError(String(error)))
  )
