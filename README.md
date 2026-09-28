# testqa

Playwright-based test suite for an HTTP API (OpenAPI-documented) and the UI that depends on it.
Covers three distinct concerns, sharing one fixture layer:

- **Contract tests** (`tests/contract/`) - does what the live server actually returns match what
  the OpenAPI spec documents for that status code? Independent of business logic; here to catch
  the spec (or the implementation) drifting without anyone announcing it.
- **Flow tests** (`tests/flow/`) - does the API actually *do* the right thing? A `200` only proves
  the server acknowledged a request, not that it processed it correctly - every mutation is
  verified with an independent follow-up read.
- **UI tests** (`tests/ui/`) - does the UI, which itself calls the API for auth and actions, behave
  correctly end to end?

This repo is wired up against the public [Swagger Petstore v3](https://petstore3.swagger.io) demo
(used as the concrete example for this setup), but nothing in the suite is Petstore-specific beyond
`.env` and the test data in `src/testData/` - see [Layout](#layout).

## Setup

```bash
npm install
npx playwright install chromium   # first time only
cp .env.example .env              # already done in this checkout; edit if you need different values
```

## Running tests

```bash
npm test                 # everything
npm run test:contract    # contract tests only
npm run test:flow        # flow tests only
npm run test:ui          # UI tests only, headless
npm run test:headed      # UI tests, headed browser
```

Reports:

```bash
npm run allure:generate  # writes allure-report/ from the last run's allure-results/
npm run allure:open      # opens the generated report
npm run allure:serve     # generate + open in one step, no static output kept
```

Every request the suite makes goes through `fetch` wrapped by
[allure-fetch](https://www.npmjs.com/package/allure-fetch) (official Allure tooling), which
attaches a structured "HTTP Exchange" to the report on every call - method, URL, full request and
response headers and bodies, timing - with sensitive headers (`authorization`, API keys, cookies,
...) redacted by default. Expand a test's steps in the report to see exactly what was sent where
and what came back, without re-running anything or reading raw JSON blobs.

## How contract tests are built

Contract coverage is table-driven, deliberately favoring being easy to read and extend over being
fully automated. Four layers, each with one job:

1. **`src/spec/endpoints.ts`** - every OpenAPI path template the suite uses, grouped by resource
   (`pet` / `store` / `user`). The one place a path is spelled out.
2. **`src/testData/*.testData.ts`** - one file per endpoint group, each exporting one scenario
   array per HTTP method actually used against that group (e.g. `petGetScenarios`,
   `petPostScenarios`, `petPutScenarios`, `petDeleteScenarios`). Every entry is a plain object with
   everything a test needs to know: `name`, request shape (`pathParams`/`queryParams`/
   `headers`/`body`), `expectedStatus`, `expectValidSchema`, and `requiresAuth` - whether the
   request needs an authenticated session first. A value like `"{{nonexistentPetId}}"` is resolved
   at run time against the live `.env` config (see `src/testData/templateContext.ts`) instead of
   being hard-coded, so it stays in sync automatically. A scenario that mutates a real resource
   provisions and tears down its own via an optional `setup` hook - see the JSDoc on `Scenario` in
   `src/testData/types.ts` for the full field-by-field contract.
3. **`src/steps/*.steps.ts`** - small, reusable behaviours a scenario can ask for by flag, e.g.
   `login`/`logout` (`src/steps/auth.steps.ts`) or `createDisposablePet`/`deletePet`
   (`src/steps/pet.steps.ts`). This is the reusability layer: the same `login()` call backs every
   `requiresAuth: true` scenario across every spec file.
4. **`tests/contract/*.contract.spec.ts`** - one file per endpoint group, one `describe` block per
   HTTP method, each just a `for` loop over that method's scenario array. The loop body is the same
   in every block: resolve the scenario's template tokens, run `scenario.setup` if present, call
   `login()` first if `scenario.requiresAuth`, send the request, assert `expectedStatus` and (if
   `expectValidSchema` is set) hand the response to `validateSchema`, then always run any
   `teardown`. Adding coverage for another case is adding an entry to the scenario array, not
   writing a new test.

This trades some automation (there's no spec-driven case generation - every case is declared by
hand) for something more valuable past a handful of endpoints: opening any spec file shows exactly
what's being sent and expected, and a new case is a data entry anyone on the team can add without
learning the runner's internals.

### Mutating scenarios (PUT/DELETE) and idempotency

A scenario's `setup` hook exists for one reason: a scenario that mutates a *real* resource must
never point at a shared `.env` fixture. Without it, e.g. "delete the existing pet" would succeed
once and then fail every subsequent run/retry for a reason that has nothing to do with spec drift -
it consumed the one fixture other tests also read. `setup` creates a private, disposable resource
immediately before the scenario's own request runs, and its optional `teardown` always runs after
(pass or fail), so the scenario is self-contained and safe to rerun or retry indefinitely - see the
`petPutScenarios`/`petDeleteScenarios` entries in `src/testData/pet.testData.ts` for both shapes
(one where the mutation is its own cleanup, one where `teardown` does it).

This same class of problem showed up one level up, independent of `setup`: the shared fixture pet
(`API_EXISTING_PET_ID`, id `1`) has been observed to disappear from the public demo entirely - not
from anything this suite did, just the reality of depending on a shared, externally-owned server
with no seed-data guarantees. `tests/global-setup.ts` checks for it and recreates it if missing,
before any test runs. A real target API would either own a test environment with durable seed data,
or need its own equivalent of this step - the underlying lesson is the same one `setup`/`teardown`
encode: never assume a fixture ID from `.env` is permanent unless something in the run actually
guarantees it.

## Why some tests are pinned to unexpected behaviour

A few scenarios assert on *currently observed* behaviour of the public demo rather than the "happy
path" you'd expect from reading the spec alone - each confirmed by hand with `curl` against the live
spec/server before being written into `src/testData/`, not guessed:

- `src/testData/pet.testData.ts` - `GET /pet/{petId}` and `POST /pet/{petId}` (form update) both
  document their error statuses (404) with no response schema, or don't document them at all, yet
  the live server returns a text body either way. `POST /pet` with a malformed payload 500s, a
  status the spec doesn't document at all.
- `src/testData/store.testData.ts` - `GET /store/inventory` currently 500s on the public demo (a
  server-side issue on the demo itself, verified with `curl`, not something wrong with this suite).
  `GET /store/order/{orderId}` for an unknown order documents 404 but with no schema, and the live
  server returns a body anyway.
- `src/testData/user.testData.ts` - `POST /user` and `GET /user/{username}` for an unknown user
  currently 500 on the public demo; `GET /user/logout` documents no response content at all, yet
  returns a body.
- `src/testData/pet.testData.ts`'s `petDeleteScenarios` - the public demo doesn't actually enforce
  `api_key` on `DELETE /pet/{petId}` (both a valid and an invalid key currently succeed). Point
  `API_BASE_URL` at a backend that does enforce auth and these become `expectedStatus: 401` (or
  your API's real rejection code) - the `requiresAuth` + header plumbing does not change.

None of this is a gap to "fix" in this repo - it's exactly the kind of thing contract testing exists
to surface. Point this suite at a different, healthier backend and these are the entries in
`src/testData/*.testData.ts` you'd update first; nothing about the endpoints/steps/spec layers needs
to change.

Everything talks to a real, third-party-hosted demo rather than a mock, so `retries: 1` is set by
default (2 on CI) to absorb its occasional network/render hiccups - see `playwright.config.ts`.
Retries don't affect any of the above: they absorb transient network/render flakiness, not a
verified, repeatable drift finding.

## Layout

```
src/
  config/env.ts            typed .env access for the single configured API
  spec/endpoints.ts         every OpenAPI path template the suite uses, grouped by resource
  spec/loadSpec.ts          fetches + fully dereferences the OpenAPI spec, caches it to disk
  spec/schemaValidator.ts   Ajv-backed validation of a response against the spec's schema for
                             method+path+status, including detection of undocumented statuses/bodies
  testData/types.ts         the `Scenario` shape every *.testData.ts array is built from
  testData/templateContext.ts  resolves a scenario's `{{token}}` placeholders against live .env config
  testData/pet.testData.ts     pet scenarios, one array per HTTP method used against /pet*
  testData/store.testData.ts   store scenarios, one array per HTTP method used against /store*
  testData/user.testData.ts    user scenarios, one array per HTTP method used against /user*
  steps/auth.steps.ts       login/logout - the auth behaviour a `requiresAuth` scenario runs first
  steps/pet.steps.ts        createDisposablePet/deletePet - self-provisioning for mutating scenarios
  fixtures/apiClient.ts     fetch wrapped with allure-fetch; every call gets a full HTTP Exchange
                             attachment (request + response, redacted) with no logging code of our own
  fixtures/index.ts         the shared `test`/`expect` every spec file imports - wires apiClient,
                             credentials, fixtureIds and validateSchema together so contract/flow/UI
                             tests all get identical fixtures without repeating setup
  pageObjects/SwaggerUIPage.ts  page object for the UI tests
  utils/buildPath.ts        fills a templated OpenAPI path ("/pet/{petId}") with concrete values
  utils/testData.ts         randomised-but-collision-safe test data builders, typed against the
                             spec-generated types (see below)
  types/api.d.ts            generated by `npm run types:generate` (also runs before every `npm test`
                             via `pretest`) - gitignored, not committed; see "Compile-time types" below
tests/
  global-setup.ts           fetches/caches the OpenAPI spec once per run
  contract/  flow/  ui/     the actual specs - contract/*.spec.ts are for-loops over src/testData/*
scripts/generateTypes.ts    runs openapi-typescript against the configured spec URL
playwright.config.ts        one Playwright project per test type (contract/flow/UI)
```

## Compile-time types

`npm run types:generate` (also wired as `pretest`, so plain `npm test` always has fresh types)
runs [openapi-typescript](https://www.npmjs.com/package/openapi-typescript) against the configured
spec URL and writes `src/types/api.d.ts`. This is a pure authoring-time aid - `randomPetPayload` and
a few `apiClient.get<T>()` calls are typed against the generated `components['schemas']['Pet']`, so
a field rename or a newly-required property in the spec breaks the build immediately, not at test
run time.

It is **not** a substitute for `validateSchema`/contract testing: types are erased at compile time
and can't tell you what the live server actually returned. A response can satisfy the type a test
assumed and still violate the real spec (or violate nothing the type system encodes at all, like
an undocumented status). Only `validateSchema`, checked against the response you actually got
back, proves that - which is why it exists as a separate, runtime layer rather than being replaced
by this.

## Reusability by design

`tests/contract`, `tests/flow` and `tests/ui` all `import { test, expect } from '../../src/fixtures'`
and receive the same `apiClient`, `credentials`, `fixtureIds` and `validateSchema` fixtures. A
credential or endpoint change in `.env` propagates to all three layers automatically; no fixture is
redefined per layer. Behaviour (`login`, `createDisposablePet`, ...) is centralised the same way in
`src/steps/`, so a scenario asks for it by flag (`requiresAuth: true`) rather than every spec file
reimplementing it.

## Scaling past the Petstore example

This was set up against the Petstore demo (~19 operations) to keep the example concrete and
independently verifiable. For a real spec in the 10-100 endpoint range, the same pattern holds:

- Add the path template to `src/spec/endpoints.ts` if it isn't there yet.
- Add a scenario to the matching `src/testData/<group>.testData.ts` array for the HTTP method in
  question - a few lines: request shape, `expectedStatus`, `expectValidSchema`, `requiresAuth`.
- Add a `src/steps/*.steps.ts` function only for behaviour that's genuinely reused across scenarios
  (auth, resource provisioning); a one-off scenario doesn't need one.
- Reuse `apiClient`/`credentials`/`fixtureIds`/`validateSchema` throughout either way.
