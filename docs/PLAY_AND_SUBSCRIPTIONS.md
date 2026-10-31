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

Release 5 (1.0.0), which includes the RevenueCat key, is live on the internal track, with the
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

Still needs you, because it's a secret: **Google Play credentials**. In Apps → GroceryCompanion
(Play Store) → Service Account Credentials JSON, upload the key for that account, then click
Save changes. New credentials can take up to 36 hours to start working. To speed that up, change
a subscription's description in Play Console, save, then change it back.

## 5. Test a purchase

Build 5 is already on the internal track, so no rebuild is needed for this test.

1. Finish both secret steps in section 4.
2. Opt in through the testing link above, install from Play (not by USB: billing only works
   for an app installed from Play), and buy Monthly. Test renewals are fast.

**Passes when:** the Pro screen shows the Play prices; the purchase unlocks Pro; the webhook
writes `subscriptions/{uid}`; a second device on the same account shows Pro; cancelling or
expiry returns the app to Free.
