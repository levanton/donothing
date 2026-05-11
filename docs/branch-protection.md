# Branch protection on `master`

GitHub's repository-level setting — has to be done in the web UI
because the GitHub API requires a personal/org admin token we don't
keep in CI.

## What this gives us

- Every change to `master` goes through a PR (no direct pushes,
  including from local pre-push escapes).
- CI (`.github/workflows/test.yml`) must be green before merge.
- Stale PRs need a re-run of CI when `master` moves forward, so a
  red-on-merge surprise is impossible.

## One-time setup

1. https://github.com/levanton/donothing/settings/branches
2. **Add classic branch protection rule** (or **Add ruleset** — both
   work; "Classic" is fewer fields and what we need).
3. **Branch name pattern:** `master`
4. Enable:
   - [x] **Require a pull request before merging**
     - [x] Require approvals: **0** (solo project — self-approval not
           required, just the PR + status check gate)
     - [x] Dismiss stale pull request approvals when new commits are
           pushed (cheap insurance)
   - [x] **Require status checks to pass before merging**
     - [x] Require branches to be up to date before merging
     - In the search box, type `test` and pick the `test` job from
       the `tests` workflow.
   - [x] **Require conversation resolution before merging** (nice-to-have)
   - [x] **Do not allow bypassing the above settings**
5. Leave the rest at defaults. **Create**.

## What changes for you after this

- `git push origin master` from your laptop **fails** with a remote
  rejection. That's by design — you can still push feature branches
  (`git push origin claude-fix/...`) and merge via PR.
- Pre-push hook continues to run locally; it just guards the feature
  branch instead of `master`.
- Emergency override exists — admins can temporarily disable the rule
  from the same settings page, or merge a PR with the "Bypass branch
  protections" toggle (admins only).

## How to verify it's on

```bash
gh api repos/levanton/donothing/branches/master/protection 2>&1 | head -20
```

Should return JSON describing the rule. A 404 means it's not set up.

## When to revisit

- If we ever add a second long-lived branch (e.g. `release-1.0`),
  duplicate the rule for that pattern.
- If we want code review (e.g. a contributor joins), bump
  "Require approvals" from 0 → 1.
