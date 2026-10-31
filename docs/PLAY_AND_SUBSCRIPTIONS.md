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

Release 8 (1.0.0), with Pro live sync and expiry alerts, is live on the internal track, with the
Owner tester list.
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

## 4. RevenueCat

Done, in project **GroceryCompanion** (`46fddbbc`): Google Play app, entitlement `pro`, products
`pro:monthly` and `pro:annual` attached to it, offering `default` with `$rc_monthly` and
`$rc_annual`, and the public Android key stored in EAS's production environment.

The webhook is added and confirmed: RevenueCat's test event got a 200 from the live function.
`revenuecat@dosealert-42199.iam.gserviceaccount.com` has access to GroceryCompanion in Play.

Google Play credentials are uploaded and show "Valid credentials", and both products show
Published. RevenueCat is connected to Google notifications on topic
`projects/dosealert-42199/topics/Play-Store-Notifications`.

Optional: for real-time renewal and cancellation events, enable that topic in Play Console →
Monetise with Play → Monetisation setup → Real-time developer notifications, then Save changes.

## 5. Test purchase (passed)

Run on 2026-10-31 on build 5, installed from Play, with a licence-test account (sandbox, not
charged). The webhook wrote `subscriptions/{uid}` with `isPro: true`, Pro unlocked on the phone,
and renewals arrived about every 6 minutes. Six renewals later Play ended the test subscription:
`EXPIRATION` set `isPro: false`, which returns the app to Free.

To repeat it: remove any copy installed by USB (a different signing key blocks the Play install),
opt in through the testing link above, install from Play (billing only works for an app installed
from Play), and buy Monthly.
