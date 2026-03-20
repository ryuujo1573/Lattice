# FP-DDD with Effect

**Implementation companion to [`docs/architecture/domain-driven-design.md`](../architecture/domain-driven-design.md)**

This guide shows how to express DDD tactical patterns — entities, value objects, aggregates, domain events, and workflows — using functional programming idioms in TypeScript with the [`effect`](https://effect.website) library.

Related: [Core Beliefs](./core-beliefs.md) · [DDD Blueprint](../architecture/domain-driven-design.md) · [Effect Reference](../references/effect.md)

---

## Core Principles

### 1. Make Illegal States Unrepresentable

Use TypeScript's type system — discriminated unions and branded types — to encode domain constraints at compile time rather than runtime checks.

```typescript
// Each lifecycle state is its own class — only a PlacedOrder can reach processOrder
class DraftOrder extends Data.TaggedClass("DraftOrder")<{ id: OrderId; lines: readonly OrderLine[] }> {}
class PlacedOrder extends Data.TaggedClass("PlacedOrder")<{ id: OrderId; lines: readonly OrderLine[]; placedAt: Date }> {}

type Order = DraftOrder | PlacedOrder

// Transition function enforces the rule at compile time
const placeOrder = (draft: DraftOrder): Effect.Effect<PlacedOrder, EmptyOrderError> =>
  draft.lines.length === 0
    ? Effect.fail(new EmptyOrderError({ orderId: draft.id }))
    : Effect.succeed(new PlacedOrder({ id: draft.id, lines: draft.lines, placedAt: new Date() }))

function processOrder(order: PlacedOrder) { /* ... */ }
```

### 2. Errors as Values, Not Exceptions

Use `Effect` / `Either` for expected domain errors. Reserve exceptions for programmer bugs.

```typescript
// Error is part of the return type — callers handle it explicitly
const getUser = (id: UserId): Effect.Effect<User, UserNotFound> =>
  Effect.tryPromise({
    try: () => db.find(id),
    catch: () => new UserNotFound({ id }),
  }).pipe(Effect.flatMap(Option.match({ onNone: () => Effect.fail(new UserNotFound({ id })), onSome: Effect.succeed })))
```

### 3. Pure Core, Impure Shell

Domain logic is pure functions with no side effects. IO lives in the infrastructure shell. The `Effect` type explicitly tracks side effects and dependencies.

```
  Input data
      │
      ▼
┌─────────────────┐
│   Domain Logic  │  ← Pure functions (domain/, application/)
│  (Pure Core)    │
└────────┬────────┘
         │ typed result
         ▼
┌─────────────────┐
│   Execute IO    │  ← Effect runners, Layer, adapters
│ (Impure Shell)  │     (infrastructure/, interfaces/)
└─────────────────┘
```

### 4. Workflows as Function Pipelines

Use `pipe()` and `Effect.flatMap` / `Effect.map` to compose domain workflows as readable, linear pipelines.

```typescript
const placeOrderWorkflow = (cmd: PlaceOrderCommand) =>
  pipe(
    validateOrder(cmd),
    Effect.flatMap(priceOrder),
    Effect.flatMap(acknowledgeOrder),
    Effect.map(createOrderEvents),
  )
```

### 5. Dependency Inversion via Effect Services

Instead of class-based IoC containers, use `Context.Tag` and `Layer` to declare and provide dependencies.

```typescript
// Declare what you need (port)
class OrderRepository extends Context.Tag("OrderRepository")<
  OrderRepository,
  { readonly save: (o: PlacedOrder) => Effect.Effect<void, DatabaseError> }
>() {}

// Use it without knowing the implementation
const saveOrder = (o: PlacedOrder) =>
  OrderRepository.pipe(Effect.flatMap((repo) => repo.save(o)))
```

---

## Tactical Patterns

### A. Domain Primitives / Value Objects (Branded Types)

Branded types give domain meaning to primitives without runtime overhead.

```typescript
import { Brand, Schema } from "effect"

// Nominal brand: zero runtime cost (identity function, erased after JIT)
type OrderId = string & Brand.Brand<"OrderId">
const OrderId = Brand.nominal<OrderId>()

// Refined brand: validates a predicate at construction time
type PositiveInt = number & Brand.Brand<"PositiveInt">
const PositiveInt = Brand.refined<PositiveInt>(
  (n) => n > 0 && Number.isInteger(n),
  (n) => Brand.error(`Expected positive integer, got ${n}`),
)

// Schema brand: encode/decode at infrastructure boundaries
const OrderIdSchema = Schema.String.pipe(Schema.brand("OrderId"))
```

**Performance notes:**
- `Brand.nominal` = identity function — zero cost after JIT inlining.
- `Brand.refined` = one predicate call at construction time, then zero cost.
- Schema brand validates exactly once at the boundary, never again inside the domain.

### B. Entities & Aggregates (Data.TaggedClass + State Machines)

Model each lifecycle state as a `Data.TaggedClass` subclass — it carries only its valid data, and transition functions consume one state and return another.

```typescript
import { Data, Effect } from "effect"

// Each lifecycle state is its own class — only carries the data valid for that state
class DraftOrder extends Data.TaggedClass("DraftOrder")<{
  readonly id: OrderId
  readonly lines: readonly OrderLine[]
}> {}

class PlacedOrder extends Data.TaggedClass("PlacedOrder")<{
  readonly id: OrderId
  readonly lines: readonly OrderLine[]
  readonly placedAt: Date
}> {}

type Order = DraftOrder | PlacedOrder

// Transition: consumes DraftOrder, produces PlacedOrder or a domain error
const placeOrder = (
  order: DraftOrder,
): Effect.Effect<PlacedOrder, EmptyOrderError> =>
  order.lines.length === 0
    ? Effect.fail(new EmptyOrderError({ orderId: order.id }))
    : Effect.succeed(
        new PlacedOrder({ id: order.id, lines: order.lines, placedAt: new Date() }),
      )
```

### C. Domain Events (Data.TaggedEnum)

Use **`Data.TaggedEnum`** to declare all event variants in one place — typed constructors, `$is` narrowing guards, and structural equality are generated automatically.

```typescript
import { Data } from "effect"

// Declare all variants in a single type alias
type OrderEvent = Data.TaggedEnum<{
  OrderPlaced:   { readonly orderId: OrderId; readonly at: Date }
  OrderShipped:  { readonly orderId: OrderId; readonly tracking: TrackingNumber }
  OrderCancelled: { readonly orderId: OrderId; readonly reason: string }
}>

// Destructure typed constructors from taggedEnum()
const { OrderPlaced, OrderShipped, OrderCancelled } = Data.taggedEnum<OrderEvent>()

// Create events — constructor arguments are fully typed
const event = OrderPlaced({ orderId: id, at: new Date() })

// Exhaustive switch — compiler catches missing cases
function projectEvent(state: OrderReadModel, event: OrderEvent): OrderReadModel {
  switch (event._tag) {
    case "OrderPlaced":    return { ...state, status: "placed",    placedAt: event.at }
    case "OrderShipped":   return { ...state, status: "shipped",   tracking: event.tracking }
    case "OrderCancelled": return { ...state, status: "cancelled", reason: event.reason }
  }
}
```

### D. Domain Errors (Tagged Errors)

Use `Data.TaggedError` so errors are typed, structurally equatable, and distinguishable in the `Effect` error channel.

```typescript
import { Data } from "effect"

class EmptyOrderError extends Data.TaggedError("EmptyOrderError")<{
  readonly orderId: OrderId
}> {}

class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: UserId
}> {}

// Effect tracks error types: the E channel below is EmptyOrderError | UserNotFound
const workflow: Effect.Effect<PlacedOrder, EmptyOrderError | UserNotFound, OrderRepository> =
  pipe(/* ... */)
```

### E. Domain Services (Pure Functions)

Domain services are pure functions or modules of functions — not classes with injected state.

```typescript
// domain/services.ts

// Pure function: no IO, no dependencies
const discountRates: Record<string, number> = { SUMMER10: 0.10, VIP20: 0.20 }

export function applyDiscount(
  order: PricedOrder,
  code: DiscountCode,
): PricedOrder {
  const rate = discountRates[code] ?? 0
  return { ...order, total: order.total * (1 - rate) }
}

// Pure function returning Effect for domain errors only
export function validateOrderLines(
  lines: readonly UnvalidatedLine[],
): Effect.Effect<readonly ValidatedLine[], ValidationError> {
  // ...
}
```

### F. Application Workflows (Effect Pipelines)

The workflow type signature declares success, errors, and dependencies in full:
`Effect.Effect<SuccessType, ErrorType, DependencyRequirements>`

```typescript
// application/workflows.ts
import { Effect, pipe } from "effect"

// Type signature communicates the full contract:
//   Success  → PlacedOrder
//   Errors   → ValidationError | EmptyOrderError | DatabaseError
//   Needs    → OrderRepository
const placeOrderWorkflow = (
  cmd: PlaceOrderCommand,
): Effect.Effect<
  PlacedOrder,
  ValidationError | EmptyOrderError | DatabaseError,
  OrderRepository
> =>
  pipe(
    validateOrderCommand(cmd),          // Effect<ValidatedOrder, ValidationError>
    Effect.flatMap(placeOrder),         // Effect<PlacedOrder, EmptyOrderError>
    Effect.flatMap((order) =>
      OrderRepository.pipe(
        Effect.flatMap((repo) => repo.save(order).pipe(Effect.as(order))),
      ),
    ),
  )
```

### G. Ports & Adapters (Context.Tag + Layer)

```typescript
import { Context, Effect, Layer } from "effect"

// Port — defined in application/ports.ts
class OrderRepository extends Context.Tag("OrderRepository")<
  OrderRepository,
  {
    readonly findById: (id: OrderId) => Effect.Effect<Order | null, DatabaseError>
    readonly save: (order: PlacedOrder) => Effect.Effect<void, DatabaseError>
  }
>() {}

// Adapter — implemented in infrastructure/adapters.ts
const PostgresOrderRepo = Layer.succeed(OrderRepository, {
  findById: (id) => Effect.tryPromise({ try: () => pg.query(id), catch: toDbError }),
  save: (order) => Effect.tryPromise({ try: () => pg.insert(order), catch: toDbError }),
})

// Composition root — interfaces/handlers.ts or main entry point
const AppLayer = PostgresOrderRepo

const main = placeOrderWorkflow(cmd).pipe(Effect.provide(AppLayer), Effect.runPromise)
```

### H. Schema-Driven Boundaries (Parse, Don't Validate)

Use `Schema` at infrastructure and interface boundaries to decode external data into domain types. The domain core never receives unvalidated data.

> Aligns with [Core Beliefs](./core-beliefs.md): *"Parse at the boundary: UI must not assume unvalidated shapes from adapters or network."*

```typescript
import { Schema, Effect } from "effect"

// infrastructure/schemas.ts
const OrderLineSchema = Schema.Struct({
  productId: Schema.String.pipe(Schema.brand("ProductId")),
  quantity: Schema.Number.pipe(Schema.filter((n) => n > 0)),
})

const PlaceOrderCommandSchema = Schema.Struct({
  customerId: Schema.String.pipe(Schema.brand("CustomerId")),
  lines: Schema.Array(OrderLineSchema),
})

// interfaces/handlers.ts
const handleRequest = (rawBody: unknown) =>
  pipe(
    Schema.decodeUnknown(PlaceOrderCommandSchema)(rawBody), // fails fast with structured errors
    Effect.flatMap(placeOrderWorkflow),                     // domain sees only valid types
  )
```

---

## Mapping to Your Project

### Target Directory Structure

Within any package following this model, keep the four layers separate:

```
<your-package>/src/
  domain/
    types.ts          # Branded types, Data.TaggedClass states, Data.TaggedEnum events
    errors.ts         # Data.TaggedError definitions
    services.ts       # Pure domain functions
  application/
    workflows.ts      # Effect pipelines composing domain logic
    ports.ts          # Context.Tag service definitions
  infrastructure/
    adapters.ts       # Layer implementations of ports
    schemas.ts        # Schema decode/encode for external data
  interfaces/
    handlers.ts       # HTTP/CLI/UI handlers — wires workflows and provides layers
```

### Dependency Flow

```
interfaces/ ──► application/ ──► domain/
     │                │
     └──► infrastructure/ ──► application/ (implements ports)
```

`domain/` has no outward dependencies. `infrastructure/` and `interfaces/` are the only layers that touch IO.

---

## Performance Notes

| Construct | Cost | Notes |
|---|---|---|
| `Brand.nominal` | Zero (after JIT) | Identity function, inlined by TurboFan |
| `_tag` discriminator | ~8 bytes/object | Interned string pointer; improves V8 hidden-class stability |
| `pipe()` | ~20–50 ns (nanoseconds) warm | Inlined by TurboFan after warm-up |
| `Effect` pipeline | ~200–500 ns/pipeline | Use at workflow level, not in tight loops |
| `Schema.decode` | ~1–5 µs (microseconds)/call | Run once at the boundary, never inside the domain core |

For computation-heavy inner loops, drop to plain functions inside `Effect.sync()`:

```typescript
const processItems = (items: readonly Item[]) =>
  Effect.sync(() => items.map(computeHeavyTransform)) // plain function inside Effect.sync
```

---

## Quick Reference

| Situation | Pattern |
|---|---|
| Computation-heavy inner loop | `Effect.sync(() => items.map(transform))` |
| Expected domain error | `Effect.fail(new MyError({ ... }))` |
| External data entry point | `Schema.decodeUnknown(MySchema)(rawInput)` |
| Entity lifecycle states | `Data.TaggedClass` per state, union for the aggregate |
| Domain events / commands | `Data.TaggedEnum` + `Data.taggedEnum()` destructuring |
| Port declaration | `class MyRepo extends Context.Tag("MyRepo")<...>() {}` |
| Adapter / implementation | `Layer.succeed(MyRepo, { ... })` |
| IO-heavy computation | Wrap once at the boundary; keep domain functions pure |

---

## References

- [DDD Blueprint](../architecture/domain-driven-design.md) — strategic and tactical design context
- [Core Beliefs](./core-beliefs.md) — UI and data-flow principles
- [Effect Reference](../references/effect.md) — quick reference card
- [effect.website](https://effect.website) — official Effect documentation
- *Domain Modeling Made Functional* — Scott Wlaschin (conceptual foundation)
- [fsharpforfunandprofit.com](https://fsharpforfunandprofit.com) — Railway Oriented Programming and type-driven design
