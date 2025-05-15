#!/usr/bin/env bash

set -ev

yarn install
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git config user.name 'github-actions[bot]'
node fetcher.js fetch-last 1
git checkout gh-pages
mkdir -p dist
cp out/*.json dist/
git add dist/*

if [ -z "$(git status --porcelain --untracked-files=no)" ]; then
    echo "No changes to commit"
else
    git commit -m "$1"
    git push
fi
