#!/usr/bin/env bash

set -e

main() {
    yarn install
    
    terms="$(node fetcher.js list-terms --space-sep)"
    if [ "$BANNERWEB_SKIP_EXISTING" = 1 ]; then
        git checkout gh-pages
    fi
    for term in $terms; do
        if [ "$BANNERWEB_SKIP_EXISTING" = 1 ]; then
            if [ -f "dist/$term.json" ]; then
                echo "... Skipping term: $term"
                continue
            fi
            git checkout main
        fi
        rm -rf fetch-cache
        ./workflow-run.sh "Manual fetch for $term ($(date +'%F %H:%M:%S') UTC)" fetch "$term"
        if [ "$BANNERWEB_SKIP_EXISTING" = 1 ]; then
            git checkout gh-pages
        fi
    done
    if [ "$BANNERWEB_SKIP_EXISTING" = 1 ]; then
        git checkout main
    fi
}

main
