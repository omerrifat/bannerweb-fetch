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
    git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
    git config user.name 'github-actions[bot]'
    node fetcher.js "$2" "$3"
    git checkout gh-pages
    mkdir -p dist
    cp out/*.json dist/ || true
    git add dist/*

    if [ -z "$(git status --porcelain --untracked-files=no)" ]; then
        echo "No changes to commit"
    else
        git commit -m "$1"
        git push origin gh-pages
    fi

    git checkout main
}

main "$@"
