#!/usr/bin/env bash

# 
# bannerweb-fetch - Scripts for fetching Sabanci University course details
# Copyright (C) 2025 Ömer Rıfat Kuldaşlı
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https:#www.gnu.org/licenses/>.
# 

set -e

main() {
    yarn install
    
    terms="$(node fetcher.js list-terms --space-sep)"
    if [ "$BANNERWEB_SKIP_EXISTING" = 1 ]; then
        echo "... Will skip existing terms"
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
