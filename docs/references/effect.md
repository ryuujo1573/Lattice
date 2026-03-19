# Effect Library Reference

**What it is:** A typed functional effect system for TypeScript that models side effects, errors, and dependencies as values.

Official docs: [effect.website](https://effect.website)

Related: [FP-DDD with Effect](../design-docs/fp-ddd-with-effect.md)

---

## Core Type

```typescript
Effect<Success, Error, Requirements>
```

| Channel | Meaning |
|---|---|
| `Success` | The value produced on success |
| `Error` | The typed union of expected errors |
| `Requirements` | Services that must be provided before running |

An `Effect` is a description of a computation — it does nothing until you run it with `Effect.runPromise` / `Effect.runSync`.

---

## Key Modules

### `Effect`

Core primitives for building and composing effects.

```typescript
import { Effect, pipe } from "effect"

Effect.succeed(value)                     // wrap a value
Effect.fail(error)                        // wrap an error
Effect.sync(() => sideEffect())           // wrap a synchronous side effect
Effect.tryPromise({ try, catch })         // wrap a promise with error mapping

pipe(eff, Effect.map(f))                  // transform success value
pipe(eff, Effect.flatMap(f))              // chain effects (f returns an Effect)
pipe(eff, Effect.mapError(f))             // transform error value
pipe(eff, Effect.catchTag("Tag", f))      // recover from a specific tagged error

Effect.runPromise(effect)                 // run and return Promise<Success>
Effect.runSync(effect)                    // run synchronously (no async allowed)
```

### `pipe`

Left-to-right function composition. The value flows top-to-bottom.

```typescript
import { pipe } from "effect"

const result = pipe(
  value,
  step1,   // step1(value)
  step2,   // step2(result of step1)
  step3,   // step3(result of step2)
)
```

### `Context.Tag`

Declares a named service (a port / dependency interface). Use the class pattern for proper TypeScript inference.

```typescript
import { Context, Effect } from "effect"

class MyService extends Context.Tag("MyService")<
  MyService,
  { readonly doWork: (x: string) => Effect.Effect<number, never> }
>() {}

// Use in effects — Requirements channel captures MyService
const useIt = MyService.pipe(Effect.flatMap((svc) => svc.doWork("hello")))
```

### `Layer`

Provides an implementation of one or more `Context.Tag` services.

```typescript
import { Layer } from "effect"

const MyServiceLive = Layer.succeed(MyService, {
  doWork: (x) => Effect.succeed(x.length),
})

// Compose layers
const AppLayer = Layer.merge(MyServiceLive, AnotherServiceLive)

// Provide at the edge
const program = myEffect.pipe(Effect.provide(AppLayer))
```

### `Brand`

Type-safe domain primitives with zero or minimal runtime cost.

```typescript
import { Brand } from "effect"

type OrderId = string & Brand.Brand<"OrderId">
const OrderId = Brand.nominal<OrderId>()   // identity, zero cost

type Quantity = number & Brand.Brand<"Quantity">
const Quantity = Brand.refined<Quantity>(
  (n) => n > 0 && Number.isInteger(n),
  (n) => Brand.error(`Expected positive integer, got ${n}`),
)
```

### `Schema`

Parse and validate data at boundaries (HTTP, database, file system).

```typescript
import { Schema, Effect } from "effect"

const UserSchema = Schema.Struct({
  id: Schema.String,
  age: Schema.Number.pipe(Schema.filter((n) => n >= 0)),
})

type User = Schema.Schema.Type<typeof UserSchema>

// Decode unknown input — fails with structured ParseError
const decode = (raw: unknown) => Schema.decodeUnknown(UserSchema)(raw)
```

### `Data.TaggedError`

Typed, equatable domain errors that populate the `Error` channel.

```typescript
import { Data } from "effect"

class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: string
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}
```

---

## When to Use Effect

| Use | Avoid |
|---|---|
| Application-level workflows (request handling, use cases) | Tight computational inner loops |
| Dependency injection at the composition root | Simple pure transformations — use plain functions |
| Typed error propagation across layers | One-liners with no branching or IO |
| Wrapping external IO (DB, HTTP, file system) | |
| Resource management (`Effect.acquireRelease`) | |

---

## Minimal Example

```typescript
import { Context, Data, Effect, Layer, pipe } from "effect"

class Greeter extends Context.Tag("Greeter")<
  Greeter,
  { readonly greet: (name: string) => Effect.Effect<string, never> }
>() {}

class EmptyNameError extends Data.TaggedError("EmptyNameError")<{}> {}

const program = (name: string): Effect.Effect<string, EmptyNameError, Greeter> =>
  name.trim().length === 0
    ? Effect.fail(new EmptyNameError())
    : Greeter.pipe(Effect.flatMap((g) => g.greet(name)))

const GreeterLive = Layer.succeed(Greeter, {
  greet: (name) => Effect.succeed(`Hello, ${name}!`),
})

pipe(program("World"), Effect.provide(GreeterLive), Effect.runPromise).then(console.log)
// → Hello, World!
```
