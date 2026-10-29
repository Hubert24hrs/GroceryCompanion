# Firebase backend

GroceryCompanion works fully offline. Signing in adds sync across devices and
household sharing, backed by Firebase:

| Piece | What it does |
|---|---|
| **Firebase Auth** (email + password) | Accounts. The session persists in AsyncStorage (iOS/Android) or IndexedDB (web). |
| **Cloud Firestore** | Household data, members, invites, preferences. |
| **`firestore.rules`** | All permissions: roles, invite checks, the free-plan member limit, last-writer-wins. No server code is needed for any of it. |
| **Cloud Functions** (`functions/`) | Only `revenuecatWebhook`, which records Pro subscriptions. |

Project: **`grocery-companion-hub`** ([console](https://console.firebase.google.com/project/grocery-companion-hub/overview)).
Firestore lives in `eur3` (Europe multi-region).

## Data model

```
households/{hid}                 name, ownerId, memberIds[], ownerPro, createdAt
households/{hid}/members/{uid}   userId, role (owner|editor|viewer), email, displayName, joinedAt, inviteCode
households/{hid}/{table}/{id}    synced rows: lists, items, pantry_items, recipes, meal_plan_entries, purchases
invites/{CODE}                   householdId, role, createdBy, expiresAt, maxUses (5), useCount, revoked
users/{uid}                      householdSize, dietaryPreferences, monthlyBudget, currency
subscriptions/{uid}              isPro, expiresAt, productId, lastEvent* (written only by the webhook)
```

Synced rows use the same snake_case fields as before. `updated_at` is a
Firestore Timestamp, and `server_updated_at` is the server commit time that
clients page their pulls by (`src/sync/firestoreRemote.ts`).

## Status

- Email/Password sign-in: **enabled** (Authentication → Sign-in method).
- Firestore rules and indexes: **deployed**.
- `revenuecatWebhook`: **built and tested, not deployed**. Cloud Functions need the
  Blaze plan, and both billing accounts on the owner's Google account are closed.

## Remaining setup: deploy the webhook (needed only for Pro subscriptions)

   - Reopen a billing account (or add one) and upgrade the project to Blaze under
     [Usage and billing](https://console.firebase.google.com/project/grocery-companion-hub/usage/details).
     Light usage stays within the free allowance.
   - Then run:
     ```bash
     firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET   # make up a long random string
     npm run deploy:functions
     ```
   - In RevenueCat, go to Project → Integrations → Webhooks and add the function URL
     (`https://europe-west1-grocery-companion-hub.cloudfunctions.net/revenuecatWebhook`).
     Set the Authorization header to `Bearer <the same secret>`.
   - Use entitlement id `pro`, or change `REVENUECAT_ENTITLEMENT_ID` in `functions/.env`
     and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` in the app's `.env`.

Rules and indexes are already deployed. After changing `firestore.rules`, run
`npm run deploy:rules`.

## Local development with emulators

The emulators need Java 11 or newer. Android Studio's bundled JDK works:
`set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`.

```bash
npm run emulators            # Auth :9099, Firestore :8080, Functions :5001
```

Set `EXPO_PUBLIC_FIREBASE_EMULATORS=1` in `.env` and restart Expo. The app then
talks to the emulators (Android emulator: `10.0.2.2`). Test accounts are in
`firebase/emulator-test-accounts.json`. For the webhook, put
`REVENUECAT_WEBHOOK_SECRET=…` in `functions/.secret.local` (git-ignored).

## Tests

```bash
npm run test:rules       # 29 security-rule tests on the Firestore emulator
npm run test:functions   # webhook event handling
```
