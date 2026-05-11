# App Store Review notes

Copy/paste-ready text for **App Store Connect → App Information →
App Review Information → Notes**. Apple's reviewers see this before
they open the build, so the goal is to remove every "why is this
here?" question they might ask — especially around the FamilyControls
/ DeviceActivity entitlement, which routinely gets reject-flagged
without explicit context.

Update this file whenever you add a new sensitive entitlement, change
the demo-account credentials, or rework the screen-blocking flow.

---

## Notes (paste into App Store Connect)

```
Nothing is a wellness app that helps users stop reaching for their phone
by giving them short, ambient "do nothing" sessions and optional
scheduled screen blocks.

# Why we use FamilyControls / DeviceActivity

The app uses the Family Controls + DeviceActivity entitlement (granted
to com.levanton.nothing in Sep 2024) for one feature only: user-
configured screen blocks during scheduled mindfulness windows.

The flow is fully user-initiated and transparent:

1. User opens Settings → "+" → picks a time, duration, and weekdays.
2. The app calls AuthorizationCenter.requestAuthorization(.individual).
   Apple's system prompt is the only place that asks for permission.
3. If the user denies, no block is created; the rest of the app works.
4. If the user approves, the chosen apps are blocked only during the
   configured window. The shield (Apple's standard FamilyActivityShield)
   shows a "time to do nothing" message with two buttons:
     - "Open Nothing" — opens this app
     - "Close" — dismisses the shield (Apple-standard behaviour)

The user can disable any block at any time from Settings → toggle, or
delete it entirely. Disabling immediately unschedules the native
DeviceActivity monitor.

We do not block apps without an active, user-created schedule, and
we do not silently re-enable blocks after the user disables them.

# How to demo

Demo account is not required — there is no remote login. Steps:

1. Launch the app.
2. Skip or complete the onboarding ("Try Free for 3 Days" can be
   skipped via the X in the top-left).
3. From the home screen, tap the sliders icon (top-left) →
   "Screen blocks" → "+".
4. Pick the next 5-minute mark for "Start time", duration 5 min,
   leave weekdays as "Every day".
5. Tap Save → accept the Screen Time prompt → wait for the start time.
6. When the window opens, locked apps show the Nothing shield. Tap
   "Open Nothing" to return to the app.

# No data collection beyond crash reports

The app stores all user data locally in SQLite. No accounts, no remote
sync, no analytics. The only outbound network traffic is:

- Apple StoreKit (for the optional subscription via RevenueCat)
- Sentry crash reports (errors only, no PII, no Session Replay)

This is reflected in the privacy nutrition label.

# Subscription details

Paywall offers monthly, yearly with 3-day free trial, and lifetime.
RevenueCat is used for receipt validation. The paywall includes:
- Auto-renewal disclosure
- Terms of Use and Privacy Policy links
- Restore Purchases button
- Manage Subscription deep link to App Store account settings

Contact: levanton21@gmail.com
```

---

## Reviewer-facing FAQ (internal — don't paste)

Things Apple's reviewers have asked on similar wellness/Screen Time apps,
with the answer to keep on hand.

### "Why do you need the FamilyControls entitlement?"
See section "Why we use FamilyControls / DeviceActivity" above. The
key point: it powers an opt-in feature, not a default app behaviour.

### "How does the user remove a block?"
Settings → Screen blocks → toggle off (immediate unschedule) or swipe
left to delete entirely. The "Delete Account" button in Settings →
Account also clears every block + native monitor as part of the wipe.

### "Does the app block apps in the background without consent?"
No. A block is only registered with `DeviceActivityCenter` after:
1. The user creates the block in Settings, and
2. The user has previously approved the Screen Time authorization
   prompt.

If authorization is revoked from iOS Settings → Screen Time, the next
app launch calls `forceUnblockAll()` defensively (see
`lib/screen-time/schedule.ts:188`).

### "Why does the shield mention 'do nothing'?"
That is the in-app brand — "Nothing" is the app name. The shield's
"time to do nothing" copy comes from `SHIELD_CONFIG` in
`lib/screen-time/shield.ts` and reflects the same wellness framing as
the rest of the app.

### "What's the relationship between the entitlement and the IAP?"
Independent. Screen blocking works for free users; the IAP unlocks
unlimited blocks (free users can create one). When the subscription
lapses, blocks are unscheduled but the user's configuration is kept
in SQLite, so re-subscribing restores them.

## Submission checklist (before tapping Submit for Review)

- [ ] Notes section above is up to date (especially demo steps)
- [ ] Privacy Policy URL set in App Information
- [ ] Support URL set
- [ ] Privacy nutrition label reflects: Crash Data (Sentry), Purchases
      (RevenueCat StoreKit receipts), no other categories
- [ ] All paywall legal links work in the build
- [ ] Restore Purchases works on a fresh install (test in TestFlight)
- [ ] Screen Time prompt copy matches the on-screen rationale shown
      before the prompt fires
- [ ] Account Deletion path tested end-to-end (Settings → Account →
      Delete Account → confirm → SQLite wiped, shield released)
- [ ] What's New text written for the version
