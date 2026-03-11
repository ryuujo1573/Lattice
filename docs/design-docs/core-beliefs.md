# Core Beliefs (UI)

These beliefs are the implicit agreements that keep the UI legible to agents and maintainable over time. When a belief becomes important enough to enforce, encode it as a check (lint/tests/evals) and link it from `docs/quality/` or `docs/evals/`.

## Product & UX

- The UI is a projection of state, not a place where business rules live.
- User intent is captured explicitly (actions/events), not inferred from incidental state.
- Error states are first-class UI states and must be visible and reproducible.
- Loading states are explicit and measurable; avoid “invisible work”.

## State & Data Flow

- Prefer unidirectional data flow: state in one place, updates through explicit actions.
- Avoid hidden shared state and implicit side effects inside components.
- Parse at the boundary: UI must not assume unvalidated shapes from adapters or network.
- Prefer stable domain models in UI; map external DTOs at the boundary.

## Domain Boundaries

- UI should depend on domain APIs/services, not on infrastructure/adapters.
- Cross-domain UI coupling is prohibited unless it goes through an explicit contract.
- Names in UI follow the ubiquitous language defined in docs, not ad-hoc wording.

## Legibility & Observability

- Every important user journey must be verifiable by a runnable eval scenario.
- UI behavior should be inspectable via deterministic selectors and stable states.
- Logging/telemetry is structured and tied to user journeys, not debug prints.

## Reliability & Performance

- “Fast by default”: avoid unnecessary renders and avoidable network chatter.
- Long tasks must surface progress and remain cancellable when possible.
- Degrade gracefully: partial failures should not blank the whole UI.

## Accessibility & Internationalization

- Semantic HTML and keyboard navigation are non-negotiable.
- Text is localizable; avoid hard-coded strings where the product requires i18n.

## Change Discipline

- Prefer small, composable components with clear boundaries over monoliths.
- Avoid “clever” abstractions that reduce readability; optimize for future agents.
