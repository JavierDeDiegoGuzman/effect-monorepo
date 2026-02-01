import { Effect, Layer } from "effect"
import { PasswordError } from "@effect-monorepo/contract"

export class PasswordService extends Effect.Tag("PasswordService")<
  PasswordService,
  {
    readonly hash: (password: string) => Effect.Effect<string, PasswordError>
    readonly verify: (password: string, hash: string) => Effect.Effect<boolean, PasswordError>
  }
>() {
  static readonly Live = Layer.succeed(this, {
    hash: (password: string) =>
      Effect.tryPromise(() =>
        Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 })
      ).pipe(
        Effect.mapError((error) => new PasswordError({ reason: String(error) }))
      ),

    verify: (password: string, hash: string) =>
      Effect.tryPromise(() =>
        Bun.password.verify(password, hash)
      ).pipe(
        Effect.mapError((error) => new PasswordError({ reason: String(error) }))
      ),
  })
}
