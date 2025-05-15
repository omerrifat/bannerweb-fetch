#!/usr/bin/env bash

set -ve

main() {
    for a in $(node fetcher.js list-terms --space-sep); do
        rm -rf fetch-cache
        ./workflow-run.sh "Manual fetch for $a ($(date +'%F %H:%M:%S') UTC)" fetch "$a"
    done
}

main
