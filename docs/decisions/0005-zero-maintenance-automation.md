# 0005 - Zero-maintenance automation; humans approve only versioning

**Context.** The project is maintained by agents and scheduled automation. Humans should
only be involved where a mistake is visible to users and hard to undo.

**Decision.**

- `patch-sync` auto-merges new patches that pass the gates. If specific entities fail,
  they are auto-demoted (`modeled: false`). If nothing can be demoted, it opens an issue
  and `main` stays on the last good snapshot. Flaky fetches only open an issue after 3
  consecutive failures.
- Dependabot minor/patch updates auto-merge on green CI. Weekly health checks run against
  the deployed site.
- Agents may merge any change once CI is green.
- **Versioning is the single human gate.** `release.yml` generates a committed safety
  report (`docs/releases/v<version>.md`) and opens a `release` PR. `release-guard.yml`
  fails any PR that changes `package.json` `version` unless it carries the `release`
  label, includes the matching report, isn't set to auto-merge, and has a non-bot
  approval. Tags and GitHub Releases are created only after that PR is merged.

**Consequences.** Conventional commits are required, because the report derives the
semver bump from them. Agents must never bump the version, tag or approve a release PR.
