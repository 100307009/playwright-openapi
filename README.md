# testqa

Playwright-based test suite for a versioned HTTP API (OpenAPI-documented) and the UI that
depends on it. Covers three distinct concerns, sharing one fixture layer:

- **Contract tests** (`tests/contract/`) - does what the live server actually returns match what
  the OpenAPI spec documents for that status code? Independent of business logic; here to catch
  the spec (or the implementation) drifting without anyone announcing it. Two styles live side by
  side - see [Two styles of contract test](#two-styles-of-contract-test).
- **Flow tests** (`tests/flow/`) - does the API actually *do* the right thing? A `200` only proves
  the server acknowledged a request, not that it processed it correctly - every mutation is
  verified with an independent follow-up read.
- **UI tests** (`tests/ui/`) - does the UI, which itself calls the API for auth and actions, behave
  correctly end to end?

Any of the three can run against multiple API versions. This repo ships with **v2** wired up to
the public [Swagger Petstore v3](https://petstore3.swagger.io) demo (used as the Petstore
stand-in requested for this setup); **v1** is scaffolded but not wired to a spec yet - see
[Adding a second API version](#adding-a-second-api-version).

## Setup

```bash
npm install
npx playwright install chromium   # first time only
cp .env.example .env              # already done in this checkout; edit if you need different values
```

## Running tests

```bash
npm test                 # everything
npm run test:contract    # contract tests only (v2)
npm run test:flow        # flow tests only (v2)
npm run test:ui          # UI tests only (v2, headless)
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

## Two styles of contract test

**Hand-written** (`tests/contract/pet.contract.spec.ts`, `store.contract.spec.ts`,
`user.contract.spec.ts`) - each test pins a specific, verified outcome: call this endpoint, expect
this exact status, expect the response to satisfy (or, for a documented drift, to *fail*) the
spec's schema for that status. This reads as a stable baseline: a currently-known issue stays a
calm, understood, passing assertion; a genuinely new regression stands out because something that
used to pass now doesn't.

**Generated** (`tests/contract/generated.contract.spec.ts` + `src/spec/contractCases.ts`) - one
Playwright test per case, built at collection time from whichever spec `global-setup` just fetched
- nothing written to disk, nothing to regenerate. Each case only declares *what request to send*
(an operationId plus example path/query params or a body - the one thing the spec alone can't
supply); it declares no expected outcome. The test takes whatever status actually comes back and
requires it to match what the live spec documents for that status, right now. Extending coverage
to another operation is a few-line entry in `contractCases.ts`, not a new test file.

The trade-off is real and deliberate: a generated case for an operation that's currently
noncompliant **fails on every run** until it's actually fixed upstream - there's no pinning to make
it read as a calm, expected baseline the way the hand-written style does. On the public Petstore
demo, most of the operations picked for generated coverage (`logoutUser`, `getUserByName`,
`getOrderById`, `findPetsByTags`, `updatePetWithForm`, `deletePet`) currently fail this way; each
failure's `validateSchema` error names exactly what's wrong (undocumented status, or a body where
the spec declares none). That's accurate, not a bug in the suite - see the next section.

### Mutating cases (PATCH/PUT/DELETE) and idempotency

A case's `setup` hook exists for one reason: a case that mutates a *real* resource must never point
at a shared `.env` fixture. Without it, e.g. "delete the existing pet" would succeed once and then
fail every subsequent run/retry for a reason that has nothing to do with spec drift - it consumed
the one fixture other tests also read. `setup` creates a private, disposable resource immediately
before the case's own request runs, and its optional `teardown` always runs after (pass or fail),
so the case is self-contained and safe to rerun or retry indefinitely - see
`deletePet (real pet, self-provisioned)` and `updatePetWithForm (real pet, self-provisioned)` in
`contractCases.ts` for both shapes (one where the mutation is its own cleanup, one where `teardown`
does it). Confirmed by running the suite twice back to back and checking for no cross-run failures.

This same class of problem showed up one level up, independent of `setup`: mid-development, the
shared fixture pet (`API_V2_EXISTING_PET_ID`, id `1`) disappeared from the public demo entirely -
not from anything this suite did (verified: `existingPetId` is only ever read via `GET` anywhere in
this codebase), just the reality of depending on a shared, externally-owned server with no seed-data
guarantees. `tests/global-setup.ts` now checks for it and recreates it if missing, before any test
runs. A real target API would either own a test environment with durable seed data, or need its own
equivalent of this step - the underlying lesson is the same one `setup`/`teardown` encode: never
assume a fixture ID from `.env` is permanent unless something in the run actually guarantees it.

## Why some tests are red

A few tests assert on, or fail because of, *currently observed* behaviour of the public demo
rather than the "happy path" you'd expect from reading the spec alone - all confirmed by hand with
`curl` before being written into the suite, not guessed:

- `tests/contract/pet.contract.spec.ts` - `GET /pet/{petId}` documents `404` as a valid status but
  declares no response content for it; the live server returns a body anyway. `POST /pet` with a
  malformed payload currently 500s, a status the spec doesn't document at all. Both pinned as
  known drift (`expect(result.valid).toBe(false)`), so they pass.
- `tests/contract/store.contract.spec.ts`, `tests/contract/user.contract.spec.ts` - `/store/*` and
  `/user/*` (aside from `GET /user/login`) currently return `500` on the public demo. Also pinned
  as known drift, so they pass.
- `tests/contract/generated.contract.spec.ts` - unpinned by design (see above), so 6 of its 7 cases
  are currently **red**, each for a real, verified reason: `logoutUser`, `updatePetWithForm` and
  `deletePet` return undocumented bodies; `getUserByName`, `getOrderById` and `findPetsByTags` 500
  the same way the hand-written `/store` and `/user` tests already document. The 7th case
  (`updatePetWithForm`, real self-provisioned pet) is genuinely spec-compliant and passes.
- `tests/flow/auth.flow.spec.ts` - the public demo doesn't actually enforce `api_key` on
  `DELETE /pet/{petId}`, and `/user/login` doesn't check the password. Both marked with `TODO`
  comments for when this suite is pointed at a backend that does enforce auth.

None of this is a gap to "fix" in this repo - it's exactly the kind of thing contract/flow testing
exists to surface. If you point this suite at a different, healthier backend, the hand-written
tests' pinned expectations are what you'd update first; the generated suite needs no changes at
all - it'll simply turn green as the real drift it's reporting gets fixed.

Everything talks to a real, third-party-hosted demo rather than a mock, so `retries: 1` is set by
default (2 on CI) to absorb its occasional network/render hiccups - see `playwright.config.ts`.
Retries don't affect any of the above: they absorb transient network/render flakiness, not a
verified, repeatable drift finding.

## Layout

```
src/
  config/env.ts          typed .env access, one block of variables per API version
  spec/loadSpec.ts        fetches + fully dereferences the OpenAPI spec, caches it to disk;
                           also findOperationByOperationId, used by the generated contract suite
  spec/schemaValidator.ts  Ajv-backed validation of a response against the spec's schema for
                           method+path+status, including detection of undocumented statuses/bodies
  spec/contractCases.ts   config for the generated contract suite - see tests/contract/generated.contract.spec.ts
  fixtures/apiClient.ts   fetch wrapped with allure-fetch; every call gets a full HTTP Exchange
                           attachment (request + response, redacted) with no logging code of our own
  fixtures/index.ts        the shared `test`/`expect` every spec file imports - wires apiClient,
                           credentials, fixtureIds, validateSchema and the `apiVersion` option
                           together so contract/flow/UI tests all get identical, correctly-scoped
                           fixtures without repeating setup
  pageObjects/SwaggerUIPage.ts  page object for the UI tests
  utils/testData.ts        randomised-but-collision-safe test data builders, typed against the
                           spec-generated types (see below)
  types/api-v2.d.ts        generated by `npm run types:generate` (also runs before every `npm test`
                           via `pretest`) - gitignored, not committed; see "Compile-time types" below
tests/
  global-setup.ts          fetches/caches every configured version's spec once per run
  contract/  flow/  ui/    the actual specs
scripts/generateTypes.ts   runs openapi-typescript against every configured version's spec URL
playwright.config.ts       one Playwright "project" per (test type, API version) pair, each
                           setting the `apiVersion` fixture option - no test file branches on
                           version itself
```

## Compile-time types

`npm run types:generate` (also wired as `pretest`, so plain `npm test` always has fresh types)
runs [openapi-typescript](https://www.npmjs.com/package/openapi-typescript) against each
configured version's live spec URL and writes `src/types/api-<version>.d.ts`. This is a pure
authoring-time aid - `randomPetPayload` and a few `apiClient.get<T>()` calls are typed against the
generated `components['schemas']['Pet']`, so a field rename or a newly-required property in the
spec breaks the build immediately, not at test run time.

It is **not** a substitute for `validateSchema`/contract testing: types are erased at compile time
and can't tell you what the live server actually returned. A response can satisfy the type a test
assumed and still violate the real spec (or violate nothing the type system encodes at all, like
an undocumented status). Only `validateSchema`, checked against the response you actually got
back, proves that - which is why it exists as a separate, runtime layer rather than being replaced
by this.

## Reusability by design

`tests/contract`, `tests/flow` and `tests/ui` all `import { test, expect } from '../../src/fixtures'`
and receive the same `apiClient`, `credentials`, `fixtureIds` and `validateSchema` fixtures,
correctly scoped to whichever `apiVersion` the running project set. A credential or endpoint
change in `.env` propagates to all three layers automatically; no fixture is redefined per layer.

## Adding a second API version

1. Fill in `API_V1_SPEC_URL`, `API_V1_BASE_URL` and the rest of the `API_V1_*` block in `.env`.
2. Uncomment the `contract-v1` / `flow-v1` project blocks at the bottom of `playwright.config.ts`
   (add a `ui-v1` block too if there's a v1 UI to test).
3. Run `npm test` - the existing test files in `tests/contract` and `tests/flow` run unchanged
   against both versions; no test code needs to change.

## Scaling past the Petstore example

This was set up against the Petstore demo (~19 operations) to keep the example concrete and
independently verifiable. For a real spec in the 10-100 endpoint range, the same pattern holds:

- Add a hand-written test in `tests/contract/` for any operation/status you want pinned as a
  stable, understood baseline (especially known drift you don't want re-litigated every run).
- Add an entry to `src/spec/contractCases.ts` for cheap, no-pinning compliance coverage of
  everything else - each entry is a few lines (`operationId` + example params/body), and the
  generated test in `tests/contract/generated.contract.spec.ts` does the rest.
- Reuse `apiClient`/`credentials`/`fixtureIds`/`validateSchema` throughout either way.
