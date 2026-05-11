# Security audit log

Last reviewed: 2026-05-11
Reviewer: production-prep pass

`npm audit` reports 15 transitive vulnerabilities. Each was traced to a
root advisory and classified by reachability — what code path actually
runs the vulnerable dependency. Anything that never executes on a
user's device is documented here as **accepted risk** with the
upstream-fix pathway noted.

This file should be re-reviewed any time Expo gets a major version
bump (the chain usually clears) or when shipping. Run:

```bash
npm audit
```

…and compare against the table below. New findings need an explicit
decision — accept (with reason), upgrade, or replace.

## Accepted risks (current state)

### 1. `postcss` < 8.5.10 — XSS via unescaped `</style>` in CSS output

| Field | Value |
|-------|-------|
| Severity | Moderate |
| Advisory | GHSA-qx2v-qp2m-jg93 |
| Chain | `expo` → `@expo/cli` → `@expo/metro-config` → `postcss` |
| Reachable at runtime? | **No.** `postcss` is invoked by Metro only when bundling for the `web` target. This project is iOS-only — `app.json` declares `ios.bundleIdentifier` but `expo build:web` / `expo start --web` are never run. |
| Mitigation | Locked Expo SDK 54 — the patched `postcss` version is queued for the SDK 55 cycle. Accept until then. |
| `npm audit fix --force` would | Downgrade Expo to 49.0.23 (breaks the entire app). Reject. |

### 2. `@xmldom/xmldom` chain — DOM clobbering in plist parsing

| Field | Value |
|-------|-------|
| Severity | High |
| Chain | `react-native-device-activity` → `@kingstinct/expo-apple-targets` → `@bacons/xcode` → `@expo/plist` → `@xmldom/xmldom` |
| Reachable at runtime? | **No.** `@bacons/xcode` parses `Info.plist` and `project.pbxproj` only during `expo prebuild` (i.e. native iOS scaffolding generation on the developer machine or EAS Build). It is not included in the runtime JS bundle and never runs on a user device. |
| Mitigation | Upstream (`react-native-device-activity`, `@kingstinct/expo-apple-targets`) needs to upgrade `@bacons/xcode`. We already maintain a local patch for `react-native-device-activity` (see `patches/`); when we revisit that patch on a future upgrade, check if the xmldom chain has cleared. |

### 3. `jest-environment-jsdom` chain — dev-only test runtime

| Field | Value |
|-------|-------|
| Severity | Low |
| Chain | `jest-expo` → `jest-environment-jsdom` → `http-proxy-agent` → `@tootallnate/once` |
| Reachable at runtime? | **No.** `jest-expo`/`jest-environment-jsdom` only load inside the Jest test runner. They are devDependencies and never ship in the production bundle. |
| Mitigation | Will clear when `jest-expo` bumps to a Jest 30+ release. Accept. |

## Resolved this pass

- `fast-uri` < 3.1.1 — path traversal / host confusion. **Fixed via
  `npm audit fix`** on 2026-05-11. Non-breaking minor bump.

## How to re-audit

```bash
npm audit                                # see current state
npm audit --json | jq '.vulnerabilities' # full structured output

# Direct (top-level) vulnerable deps only:
npm audit --json \
  | jq -r '.vulnerabilities | to_entries
            | map(select(.value.isDirect == true))
            | .[]
            | "\(.value.severity)\t\(.key)"'
```

If `npm audit fix` (without `--force`) introduces new test/typecheck
failures, revert. Anything that requires `--force` and would touch the
Expo SDK major version is **always** rejected here — that downgrade
breaks the runtime far worse than the build-time advisory it would
"fix".
