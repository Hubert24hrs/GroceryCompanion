# Play closed testing and subscriptions

The steps that need your own accounts or decisions, in order. Everything else is done.
Play app ID 4975141314886525836, package `com.hubert24hrs.grocerycompanion`.

## 1. Finish the Play setup forms

| Task | Where | Status |
|---|---|---|
| Privacy policy, ads, advertising ID, government, financial, health | App content | Saved |
| Category (Food & drink) | Store settings | Saved |
| Data safety | App content | Draft: submit after target audience |
| Store listing text and graphics | Store listings | Draft: choose the AI declaration, then Save |
| Contact email | Store settings → Store Listing contact details | Needs your email (public) |
| Content rating | App content | Needs your email; answers below |
| Sign-in details | App content | Answer **Yes**: subscriptions count as restricted |
| Target audience | App content | Unlocks after sign-in details; 18 and over |

**AI declaration (store listing, Review step):** the icon and feature graphic were drawn by
Claude with a script. The screenshots are real app screens. Choose the option you're
comfortable stating.

**Content rating:** category "All other app types". Violence, sexual content, bad language,
drugs and gambling: No. Users can exchange content: Yes, only with household members they
invite. Shares location: No. Digital purchases: Yes.

**Sign-in details:** either give reviewers an account with Pro (create it in the app, then
ask Claude to grant Pro), or explain that accounts are optional and Pro can't be bought
in this version yet.

## 2. Upload the bundle

`release/GroceryCompanion-1.0.0-4.aab` is 75 MB, too big for Claude's upload tool.

- Now: **Test and release → Testing → Internal testing → Create new release**. No setup
  forms needed, and this unlocks subscription products.
- After step 1: the same under **Closed testing**, then add at least 12 testers. They must
  stay opted in for 14 days before you can apply for production.
- Choose **Use Google-generated key** for Play app signing if asked.

## 3. Create the subscription in Play

**Monetise with Play → Products → Subscriptions → Create subscription**

| Field | Value |
|---|---|
| Product ID | `pro` |
| Base plan 1 | ID `monthly`, auto-renewing, every month, $5.99 |
| Base plan 2 | ID `annual`, auto-renewing, every year, $60 |

Activate both base plans. Play converts the prices for other countries.

Also enrol in the 15% service fee, and finish bank verification (statement upload) in
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
3. In Play Console: **Settings → License testing**, add your Google account. Testers aren't
   charged, and test renewals are fast.
4. Opt in through the testing link, install from Play (not by USB: billing only works for an
   app installed from Play), and buy Monthly.

**Passes when:** the Pro screen shows the Play prices; the purchase unlocks Pro; the webhook
writes `subscriptions/{uid}`; a second device on the same account shows Pro; cancelling or
expiry returns the app to Free.
