#!/usr/bin/env bash
# Checks out (or initializes) the orphan `patch-sync-state` branch into
# `.patch-sync-state/`, used by patch-sync.yml to persist flaky-source
# tolerance state (`scripts/gates/sync-state.ts`) across workflow runs
# without cluttering `main` or the Issues tab. Idempotent: safe to call at
# the start of every patch-sync run.
set -euo pipefail

BRANCH="patch-sync-state"
DIR=".patch-sync-state"

git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add "$DIR" "origin/$BRANCH" --detach >/dev/null
  cd "$DIR"
  git checkout -B "$BRANCH"
else
  git worktree add --detach "$DIR" HEAD >/dev/null
  cd "$DIR"
  git checkout --orphan "$BRANCH"
  git rm -rf . >/dev/null 2>&1 || true
  git -c user.email="actions@github.com" -c user.name="github-actions[bot]" \
    commit --allow-empty -q -m "chore: init patch-sync-state branch"
fi
