# GroceryCompanion — Audit & Gap Analysis

Audit of commit `05fab41` (Expo SDK 54, React Native 0.81, React 19, Zustand, expo-sqlite, Supabase JS v2).

## What exists and is worth keeping

| Area | State | Keep / change |
|---|---|---|
| Stack (Expo 54, RN 0.81, Zustand, React Navigation 7, expo-sqlite, Supabase) | Modern, compatible | Keep |
| Natural-language parsing (`utils/parsing.ts`) | Works for "2 cups milk"; no multi-item split, no "x2", no unicode fractions | Keep, extend, test |
| Keyword auto-categorization | Large dictionary; first-match ordering misfiles items (e.g. "ice cream" → dairy, "peanut butter" → dairy via "butter", "pineapple" → produce ok but "apple juice" → produce) | Keep data, switch to longest-match scoring |
| Barcode scanner (expo-camera) | Camera works; scanned code is added as `Item 0123…` — no product lookup | Keep UI, add Open Food Facts lookup + unknown-product flow |
| Recipe seed data (8 recipes) | Static, read-only, favorites not persisted | Keep as starter content imported into the user's recipe box |
| Meal planner | AsyncStorage-only, one meal per tap, no list generation, not synced | Rebuild |
| Nearby stores | Google key hard-coded placeholder → **silently returns fake stores** | Rebuild: Google (if key) or OpenStreetMap, never fake data |
| Analytics | Counts "pantry items with a price" as spending | Rebuild on a real `purchases` history |

## Critical defects found

1. **Subscription bypass** – `pro_tier_migration.sql` lets any user `update profiles set is_pro = true` (own-row update policy + `upgrade_to_pro()` RPC). The paywall is a `setTimeout` mock that grants Pro; RevenueCat is installed but never called.
2. **Sync is broken end to end** – UPDATE payloads are camelCase (`isChecked`) against snake_case columns; CREATE sends local-only columns (`is_synced`, `budget`, `price`) that don't exist remotely and `owner_id: ''` (fails RLS/uuid). Deletes never propagate on pull; pull cursor is in-memory and capped at 50 rows; failed ops are retried forever with no backoff.
3. **RLS recursion** – the `list_members` SELECT policy queries `list_members` itself → Postgres "infinite recursion detected in policy".
4. **Sharing is insecure / non-functional** – invite link is the raw list UUID; `join_list` lets anyone with the id join as editor; the share screen's members list is hard-coded.
5. **Web is non-functional** – SQLite is replaced by a no-op mock on web, so nothing persists and lists never appear.
6. **Secrets/config** – `.env` is committed; the Supabase URL/key are hard-coded in source; AdMob plugin has no app IDs (prebuild fails); the production banner id is a placeholder.
7. **Navigation stubs** – "Lists" and "Profile" tabs render placeholder text; Analytics is unreachable.
8. **Pantry model** – pantry is a flag on list items, scoped to a single list, no quantities, expiry, or low-stock thresholds.
9. **No tests, lint, or type-check scripts.**

## Missing vs. the brief

- Multiple lists ✔ exists, but no notes/units UI polish, templates, archive, reorder, or store assignment from the list.
- Households, invitations, permissions, realtime per household — missing.
- Recipe CRUD, collections, servings scaling, recipe → list with pantry awareness — missing.
- Weekly calendar with B/L/D/snacks and consolidated list generation — missing.
- Pantry quantities, expiry, low-stock alerts, duplicate-purchase prevention — missing.
- Smart meal suggestions (pantry coverage, diet, household size, budget) — missing.
- Price history per store, budgets, category breakdown, savings insights — missing.
- Unified dashboard — missing.
- Voice quick entry — missing.

## Plan (architecture decisions)

- **Local store:** one offline-first repository layer over a small storage adapter — SQLite on iOS/Android (existing database is migrated in place), `localStorage` on web, in-memory in tests. All writes go through the repository, which stamps `updated_at`, writes an outbox entry, and notifies the UI.
- **Sync:** outbox of full-row upserts with client UUIDs (idempotent `upsert … on conflict (id)`), soft-delete tombstones, last-writer-wins on `updated_at` enforced by a server trigger, persisted per-table pull cursors with paging, exponential backoff and a dead-letter state; realtime scoped to the user's household triggers pulls.
- **Sharing model:** households. Every user owns a household; lists, pantry, recipes, meal plans and purchases belong to a household. Invites are random 8-character codes with role + expiry, redeemed through a `security definer` RPC that also enforces the free-tier member limit.
- **Entitlements:** RevenueCat on device decides UI gating; the server-side `profiles.is_pro` column is writable only by the RevenueCat webhook (Edge Function with a shared secret), never by clients.
- **UI:** new token-based design system (light + dark), AnyList-style category bands and pencil-edit rows with a GroceryCompanion identity (herb green + carrot accent, rounded cards), five tabs: Home, Lists, Recipes, Meal Plan, Pantry.
