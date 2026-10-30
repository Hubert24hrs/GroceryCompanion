# Play closed testing and subscriptions

The steps that need your own accounts or decisions, in order. Everything else is done.
Play app ID 4975141314886525836, package `com.hubert24hrs.grocerycompanion`.

## 1. Play setup forms (done)

All saved, and closed testing is unlocked.

| Task | Where | Status |
|---|---|---|
| Privacy policy, ads, advertising ID, government, financial, health | App content | Saved |
| Sign-in details | App content | Saved: **No** (see below) |
| Target audience | App content | Saved: 18 and over |
| Data safety | App content | Saved |
| Store listing text and graphics | Store listings | Saved; icon and feature graphic labelled as AI-made |
| Category (Food & drink) | Store settings | Saved |
| Contact details | Store settings | Saved |
| Content rating | App content | Saved: Everyone, PEGI 3, USK all ages, Brazil 14+ |

**Sign-in details must change before Pro goes on sale.** It's **No** today because no sign-in
is required and Pro can't be bought in this build. Play needs login details for a Pro account
(or it rejects the "Yes" answer), so when a build with RevenueCat keys is submitted, create a
reviewer account in the app, ask Claude to grant it Pro, and change this to **Yes** with those
details.

## 2. Internal testing (done)

Release 4 (1.0.0) is live on the internal track, with the Owner tester list.
Opt-in link: https://play.google.com/apps/internaltest/4700202274636462994

Later, for **Closed testing**, add at least 12 testers. They must stay opted in for 14 days
before you can apply for production.

The bundle is too big for Claude's 10 MB upload limit in one piece. To upload one again, split
it into 9 MB parts, send them into a temporary file input on the release page, rejoin them
into a File, check the SHA-256, and assign that to the page's `.aab` input.

## 3. Subscription in Play (done)

Product `pro` (GroceryCompanion Pro), both base plans active in 175 countries:

| Base plan | Billing | Price |
|---|---|---|
| `monthly` | Auto-renewing, monthly | $5.99 |
| `annual` | Auto-renewing, yearly | $59.99 (Play rounds $60 to this; it can be edited) |

Your account is a licence tester, so test purchases aren't charged.

Still to do: enrol in the 15% service fee, and finish bank verification (statement upload) in
Payments profile, or payouts stay on hold.

## 4. Set up RevenueCat

1. Create an account at revenuecat.com and a project; add a Google Play app with the package
   name above.
2. Link Play with a service-account JSON key, following RevenueCat's guide.
3. Create an **entitlement** with identifier `pro`. The app and the webhook both expect
   exactly this.
4. Import the two products and attach them to the `pro` entitlement.
5. In the **current** offering, add a Monthly and an Annual package. The app labels plans by
   package type, so use those two types.
6. **Integrations → Webhooks:**
   - URL: `https://europe-west1-grocery-companion-hub.cloudfunctions.net/revenuecatWebhook`
   - Authorization header: `Bearer <secret>`, from
     `firebase functions:secrets:access REVENUECAT_WEBHOOK_SECRET`
7. Copy the public Android key (starts `goog_`) and give it to Claude.

## 5. Rebuild and test a purchase (Claude can do most of this)

1. Add the key to EAS and rebuild:
   `npx eas-cli env:create production --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value <key> --visibility plaintext --scope project`
   then `npx eas-cli build --platform android --profile production`.
2. Upload the new `.aab` to the same testing track.
3. Opt in through the testing link above, install from Play (not by USB: billing only works
   for an app installed from Play), and buy Monthly. Test renewals are fast.

**Passes when:** the Pro screen shows the Play prices; the purchase unlocks Pro; the webhook
writes `subscriptions/{uid}`; a second device on the same account shows Pro; cancelling or
expiry returns the app to Free.
