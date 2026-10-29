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
- Plan: **Blaze**, billed to the "Suskii Errands" billing account, with a $1 budget alert.
- `revenuecatWebhook`: **deployed** at
  `https://europe-west1-grocery-companion-hub.cloudfunctions.net/revenuecatWebhook`.
  It answers 401 to a wrong secret and 200 to a signed RevenueCat test event.
  The shared secret is `REVENUECAT_WEBHOOK_SECRET` in Secret Manager.

## Remaining setup: connect RevenueCat (needed only for Pro subscriptions)

1. Create the RevenueCat project, with the iOS/Android apps, products and an entitlement `pro`.
   Put its public SDK keys in the app's `.env` (`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `_ANDROID`).
2. Read the webhook secret: `firebase functions:secrets:access REVENUECAT_WEBHOOK_SECRET`.
3. In RevenueCat, go to Project → Integrations → Webhooks and add the URL above, with the
   Authorization header set to `Bearer <that secret>`. Then use **Send test event**; it should succeed.
4. Using a different entitlement id? Change `REVENUECAT_ENTITLEMENT_ID` in `functions/.env`
   and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` in `.env`, then run `npm run deploy:functions`.

If a deploy fails with "User code failed to load… Timeout", set
`FUNCTIONS_DISCOVERY_TIMEOUT=120` and deploy again (slow machines can need more than 10 s).

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
