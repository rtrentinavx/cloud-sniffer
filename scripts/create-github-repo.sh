#!/usr/bin/env bash
# Create github.com/rtrentinavx/cloud-sniffer and push main (requires: gh auth login)
set -euo pipefail
cd "$(dirname "$0")/.."

OWNER="${GITHUB_OWNER:-rtrentinavx}"
NAME="${GITHUB_REPO:-cloud-sniffer}"

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

if gh repo view "$OWNER/$NAME" >/dev/null 2>&1; then
  echo "Repo already exists: https://github.com/$OWNER/$NAME"
else
  gh repo create "$OWNER/$NAME" --public --description "Multi-cloud cost lake (Vercel + Neon) — cloud sniffer"
  echo "Created https://github.com/$OWNER/$NAME"
fi

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "git@github.com:$OWNER/$NAME.git" 2>/dev/null || \
    git remote set-url github "https://github.com/$OWNER/$NAME.git"
else
  git remote add github "https://github.com/$OWNER/$NAME.git"
fi

git push -u github main
echo "Pushed main to github remote."
