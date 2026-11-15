---

name: cut-release
description: Prepare a lol-stats-flow version release - generate the version safety report and open a human-approved release PR. Use when the user or a maintainer asks to release, bump the version, tag, publish, or "cut" a version. Agents must never bump versions any other way.
---

# Cut a release (human-approved)

Versioning is the **only** human-gated action in this repo
([ADR 0005](../../../docs/decisions/0005-zero-maintenance-automation.md)).

## Agent steps

1. Make sure `main` is green and up to date.
2. Preview the report: `npm run release:report`. It prints Markdown with:
   - the commits since the last tag and the suggested semver bump;
   - risk checks: canvas and snapshot schema versions, persistence and share-URL
     changes, major dependency bumps, golden-fixture edits, data and engine changes;
   - a verdict of SAFE or NEEDS ATTENTION.
3. If the verdict is **NEEDS ATTENTION**, deal with each flagged item first, or explain it
   in your message to the human.
4. Trigger the workflow:
   `gh workflow run release.yml -f bump=auto` (or `patch` / `minor` / `major`).
   It commits `docs/releases/v<version>.md`, the `CHANGELOG.md` entry and the
   `package.json` version on a `release/v<version>` branch, then opens a PR labelled
   `release`.
5. Tell the human the PR URL and summarize the verdict. **Stop.**

## Never

- Approve, auto-merge or `--admin` merge a `release` PR.
- Edit `package.json` `version`, push tags or run `gh release create` by hand.
- Edit a committed report in `docs/releases/`. Regenerate it instead by re-running the
  workflow.

After a human merges the PR, `release.yml` tags `v<version>` and creates the GitHub
Release from the report.
