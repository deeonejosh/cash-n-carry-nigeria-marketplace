#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="$repo_root/deploy/cloudflare-staging/build-context"
rm -rf -- "$dest"
mkdir -p "$dest"
# Avoid recursively copying staging build context into itself and exclude VCS and secrets.
rsync -a --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  --exclude='deploy/' --exclude='.env' --exclude='.env.*' \
  --exclude='*.pem' --exclude='*.key' --exclude='*.sqlite' \
  "$repo_root/" "$dest/"
test -f "$dest/Dockerfile"
test -f "$dest/package-lock.json"
test -f "$dest/prisma/schema.prisma"
echo "Staging-only Docker build context prepared"
