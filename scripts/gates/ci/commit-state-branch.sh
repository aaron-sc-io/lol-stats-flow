#!/usr/bin/env bash
# Commits + pushes whatever's staged in .patch-sync-state/ back to the
# orphan `patch-sync-state` branch. No-ops cleanly if nothing changed.
set -euo pipefail

cd .patch-sync-state
git add -A
if git diff --cached --quiet; then
  echo "[state-branch] nothing to commit"
  exit 0
fi
git -c user.email="actions@github.com" -c user.name="github-actions[bot]" \
  commit -q -m "chore: update patch-sync state"
git push -q origin HEAD:patch-sync-state
