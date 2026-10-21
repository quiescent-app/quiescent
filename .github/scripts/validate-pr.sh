#!/usr/bin/env bash

set -euo pipefail

BRANCH_NAME="${1:-}"
PR_TITLE="${2:-}"

CATEGORIES="feat|test|fix|cicd|docs|refactor|chore|perf|security"

DEVELOPER="[a-z][a-z0-9]*"
BRANCH_DESCRIPTION="[a-z0-9]+(-[a-z0-9]+)*"
TITLE_DESCRIPTION="[A-Za-z0-9]+([ -][A-Za-z0-9]+)*"

BRANCH_PATTERN="^(${CATEGORIES})/(${DEVELOPER})/(${BRANCH_DESCRIPTION})$"
TITLE_PATTERN="^(${CATEGORIES})/(${DEVELOPER}): (${TITLE_DESCRIPTION})$"

# Validate branch name
if [[ ! "$BRANCH_NAME" =~ $BRANCH_PATTERN ]]; then
    echo "::error::Invalid branch name: '$BRANCH_NAME'"
    echo "Expected: <category>/<developer>/<short-description>"
    echo "Example: cicd/tien/pr-naming-validation"
    echo "Allowed categories: ${CATEGORIES//|/, }"
    exit 1
fi

BRANCH_CATEGORY="${BASH_REMATCH[1]}"
BRANCH_DEVELOPER="${BASH_REMATCH[2]}"

# Validate PR title
if [[ ! "$PR_TITLE" =~ $TITLE_PATTERN ]]; then
    echo "::error::Invalid PR title: '$PR_TITLE'"
    echo "Expected: <category>/<developer>: <short-description>"
    echo "Example: cicd/tien: pr naming validation"
    echo "Allowed categories: ${CATEGORIES//|/, }"
    exit 1
fi

TITLE_CATEGORY="${BASH_REMATCH[1]}"
TITLE_DEVELOPER="${BASH_REMATCH[2]}"

# Ensure category matches
if [[ "$BRANCH_CATEGORY" != "$TITLE_CATEGORY" ]]; then
    echo "::error::Category mismatch!"
    echo "Branch category: $BRANCH_CATEGORY"
    echo "PR title category: $TITLE_CATEGORY"
    echo "Update the PR title to use '$BRANCH_CATEGORY'."
    exit 1
fi

# Ensure developer matches
if [[ "$BRANCH_DEVELOPER" != "$TITLE_DEVELOPER" ]]; then
    echo "::error::Developer mismatch!"
    echo "Branch developer: $BRANCH_DEVELOPER"
    echo "PR title developer: $TITLE_DEVELOPER"
    echo "Update the PR title to use '$BRANCH_DEVELOPER'."
    exit 1
fi

echo "PR naming validation passed!"