# Monetization features

Status, setup steps and test plan for the three features on `feat/monetization-features`.
Every decision (feature gates, limits, entitlement, delivery countries) is in
[src/domain/entitlements.ts](../src/domain/entitlements.ts).

## Test results

Run on 2026-10-31 on builds 8 and 10, installed from Play on the test phone, with the web preview
as the second device and a sandbox subscription.

| Check | Result |
|---|---|
| Rules, index and functions deployed | Done |
| Free: recipe to list opens; alerts and Pro features lead to the Pro screen | Passed |
| Pro: webhook sets `isPro` and `ownerPro`, app unlocks | Passed; on build 10 the first event applied at once |
| Live sync, PC to phone | Passed on builds 8 and 10, within 7 seconds |
| Live sync, phone to PC | Passed on builds 8 and 10, within 4 seconds |
| Listener stops when the list closes, catches up on reopening | Passed |
| Expiry reminder scheduled at 9 am, 2 days before; channel created | Passed |
| A reminder actually appearing at 9 am | Not seen: it needs the phone to reach that time |
| Two people in one household | Rules tests only |
| Real Instacart API | Not possible: applications are closed |
| Sign-in prompt before buying | Passed on build 10: Play's sheet never opens |
| Sandbox Pro expiring back to Free | Passed |
| Already-owned restore | Not on a device: the sign-in prompt now prevents the usual way to reach it |

Buying before signing in was found this way. The event arrives with an anonymous ID, so the webhook
records nothing until a renewal carries the account ID. Restore fixed the phone at once, and the next
renewal fixed the server, about 12 minutes later. With a real monthly plan that wait would be a month,
which is why the app now asks for sign-in first.

## Audit

The backend is already Firebase, so nothing needed migrating.

| Feature | Before | Added |
|---|---|---|
| Real-time family sync | Partial: live for everyone, on all tables, with no gate | Pro gate in the app and the rules; listens to the open list only; pull-to-refresh |
| Pantry | Exists | Nothing |
| Saved recipes, pasted ingredients, free cap of 10 | Exists | Nothing |
| Recipe to list, with review, pantry skip and merge | Exists, free with a cap of 10 recipes | Nothing: stays free |
| Expiry alerts | Partial: on-screen only, no notifications | Local notifications, permission flow, 1 to 7 days before |
| Instacart delivery | Missing | Everything, off by default |

## Gating

Live sync, expiry alerts and delivery are Pro. Recipe to list stays free, with the cap on saved
recipes in `FREE_LIMITS.recipes`. Each is one line in `FEATURE_ACCESS`.

`OWNER_PRO_UNLOCKS_HOUSEHOLD` also lives in `firestore.rules`, because the rules can't read the
app's config. `DELIVERY_COUNTRIES` and the delivery Pro check are repeated in
`functions/src/delivery.ts`; a unit test fails if the two drift apart.

## Setup

RevenueCat needs nothing new: the `pro` entitlement and the webhook already work.

1. Deploy the rules and the index:
   ```bash
   npm run deploy:rules
   ```
2. Before the next functions deploy, the new secret must exist, or the deploy fails. Until
   Instacart issues a key, any placeholder works, because `DELIVERY_ENABLED=false` stops the
   function before it uses the key:
   ```bash
   npx firebase functions:secrets:set INSTACART_API_KEY
   ```
3. Deploy the functions:
   ```bash
   npm run deploy:functions
   ```
4. Build the app with EAS. `expo-notifications` is native, so this needs a new build.

Build and deploy in this order: a build with the new listener needs the index first. Existing
builds keep working after the rules change. Free households lose their live updates at once,
while Pro households keep them until they update.

### Turning Instacart on

**Blocked as of 2026-10-31:** Instacart's page says it is not accepting new applications and has
no waitlist, so these steps can't start yet. Delivery stays off until applications reopen.

1. Apply at https://www.instacart.com/company/business/developers once applications reopen.
   Instacart quotes 30 to 40 days from request to production key.
2. Get the logo from Instacart and add it to `DeliverySheet.tsx`. Its button guidelines call for
   it, and logo use needs its marketing team's approval.
3. Create a development key in the Instacart dashboard and set it as `INSTACART_API_KEY`.
4. In `functions/.env` set `DELIVERY_ENABLED=true`, then deploy the functions.
5. Set `EXPO_PUBLIC_DELIVERY_MODE=live` in EAS and build.
6. Complete the privacy TODO in `hosting/privacy.html` and update Play's Data safety form:
   list items and postal codes go to Instacart.
7. For production, request a production key, set `INSTACART_API_URL=https://connect.instacart.com`
   and update the secret. Approval leads to an Impact invitation for commissions. Instacart adds
   the affiliate parameters itself; don't add them by hand.

For development without a key, set `EXPO_PUBLIC_DELIVERY_MODE=mock`. The sheet shows a mock
banner and nothing leaves the app.

## Manual test plan

**Live sync** (two accounts in one household)
- Free owner: a change on phone A appears on phone B only after pulling down or reopening. The
  hint shows on the list, and dismissing it keeps it away.
- Pro owner: with the same list open, the change appears within seconds for both members.
- Leave the list, or background the app: no updates arrive until you return.

**Expiry alerts**
- Free: the switch in Settings opens the Pro screen.
- Pro: turn it on and allow notifications; add an item expiring in 2 days. If it's before 9 am
  the reminder comes today, otherwise tomorrow at 9 am.
- Deny the permission: a message offers to open system settings, and the switch stays off.
- Delete the item: its reminder is cancelled.

**Recipe to list**
- Free or Pro: the sheet opens, with pantry and on-list items unticked.
- Free: saving an eleventh recipe is refused, with a link to Pro.

**Delivery region** (mock build, Settings then Country for delivery)
- United States: the list menu shows "Shop on Instacart"; ZIP `94105` is accepted, `9410` refused.
- Canada: `K1A 0B1` is accepted, `94105` refused.
- Other, or Automatic on a phone outside both countries: no delivery item anywhere.
- With delivery off (the default build): no country setting and no delivery item.

## Known limits

- The rules stop the one-row listener, but a modified app could still poll the normal pull
  query. Live sync is a convenience, not protected data, so this is acceptable.
- Live updates cover the open list only, as the cost guardrails require. Pantry, recipes and
  meal plans update on open and on pull-to-refresh, even for Pro.
- `ownerPro` is set by RevenueCat events. A household created after buying Pro stays
  `ownerPro: false` until the next renewal event.
- Instacart's docs list `postal_code` as US-only in one place while accepting `CA` as a country,
  so Canadian lookups need checking against the real API.
- Instacart's terms and messaging rules need a human read before launch, including approval of
  any public statement about the integration.
