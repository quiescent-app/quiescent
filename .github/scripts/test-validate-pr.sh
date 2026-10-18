#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-pr.sh"

PASSED=0
FAILED=0

run_test() {
    local test_name="$1"
    local expected="$2"
    local branch="$3"
    local title="$4"

    local actual="fail"

    if bash "$VALIDATOR" "$branch" "$title" > /dev/null 2>&1; then
        actual="pass"
    fi

    if [[ "$actual" == "$expected" ]]; then
        echo "PASS: $test_name"
        PASSED=$((PASSED + 1))
    else
        echo "FAIL: $test_name (expected $expected, got $actual)"
        FAILED=$((FAILED + 1))
    fi
}

# Valid cases
run_test "Valid feature" pass \
    "feat/tien/login-page" \
    "feat/tien: implement-login"

run_test "Valid CI/CD" pass \
    "cicd/kevin/github-makefile-init" \
    "cicd/kevin: setup-github-actions"

run_test "Valid documentation" pass \
    "docs/duc/update-readme" \
    "docs/duc: improve-documentation"

# Invalid branch cases
run_test "Missing category" fail \
    "tien/login-page" \
    "feat/tien: login-page"

run_test "Missing developer" fail \
    "feat//login-page" \
    "feat/tien: login-page"

run_test "Missing description" fail \
    "feat/tien/" \
    "feat/tien: login-page"

run_test "Unsupported category" fail \
    "feature/tien/login-page" \
    "feature/tien: login-page"

run_test "Uppercase branch description" fail \
    "feat/tien/Login-Page" \
    "feat/tien: login-page"

# Invalid PR title cases
run_test "Missing PR category" fail \
    "feat/tien/login-page" \
    "tien: login-page"

run_test "Missing PR developer" fail \
    "feat/tien/login-page" \
    "feat: login-page"

run_test "Missing PR description" fail \
    "feat/tien/login-page" \
    "feat/tien: "

run_test "Invalid PR description" fail \
    "feat/tien/login-page" \
    "feat/tien: Login Page"

# Mismatch cases
run_test "Category mismatch" fail \
    "feat/tien/login-page" \
    "fix/tien: login-page"

run_test "Developer mismatch" fail \
    "feat/tien/login-page" \
    "feat/kevin: login-page"

echo ""
echo "Results: $PASSED passed, $FAILED failed"

if [[ "$FAILED" -gt 0 ]]; then
    exit 1
fi