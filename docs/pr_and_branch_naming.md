# Contributing to Quiescent

Thank you for contributing to Quiescent! Please follow the guidelines below to keep our development workflow consistent.

## Branch Naming Convention

All pull request branches must follow this format:

```text
<category>/<developer>/<short-description>
```

Example:

```text
feat/kevin/github-makefile-init
```

### Approved Categories

| Category   | Description                                 |
| ---------- | ------------------------------------------- |
| `feat`     | New functionality                           |
| `test`     | Tests or test coverage                      |
| `fix`      | Bug fixes and corrections                   |
| `cicd`     | CI/CD and automation                        |
| `docs`     | Documentation changes                       |
| `refactor` | Code restructuring without behavior changes |
| `chore`    | Maintenance tasks                           |
| `perf`     | Performance improvements                    |
| `security` | Security-related changes                    |

Use `fix` for bug fixes. The `bug` category is not supported to avoid duplication.

### Naming Rules

- Use only approved categories.
- The developer segment must be a lowercase identifier beginning with a letter, followed by letters or numbers.
- The description must be lowercase and use hyphens to separate words.
- All three segments are required.
- Do not use spaces, underscores, or uppercase letters.

Valid examples:

```text
feat/tien/login-page
fix/kevin/auth-error
docs/duc/update-readme
cicd/tien/pr-naming-validation
```

Invalid examples:

```text
feature/tien/login-page     # Unsupported category
feat/login-page             # Missing developer segment
feat/tien/                  # Missing description
feat/tien/Login-Page        # Uppercase letters
```

## Pull Request Title Convention

All pull request titles must follow this format:

```text
<category>/<developer>: <short-description>
```

Example:

```text
feat/kevin: github-makefile-init
```

The category and developer must match those in the source branch name. However, the description may differ.

For example:

Branch:

```text
feat/tien/login-page
```

Valid PR title:

```text
feat/tien: implement-login
```

Invalid PR title:

```text
fix/tien: implement-login
```

The invalid example uses `fix` instead of `feat`.

## Automated Validation

Every pull request targeting `main` is automatically checked by the **PR Naming Validation** GitHub Actions workflow.

The validation checks:

- Branch name format and approved category.
- PR title format and approved category.
- Matching category and developer between the branch and PR title.

If validation fails, review the GitHub Actions error message and correct the branch name or PR title.

You can test naming locally:

```bash
bash .github/scripts/validate-pr.sh \
  "feat/tien/login-page" \
  "feat/tien: implement-login"
```

Run the complete validation test suite:

```bash
bash .github/scripts/test-validate-pr.sh
```

## Development Checks

Before submitting a pull request, run:

```bash
make lint
make test
make build
```

These commands check code quality, run tests, and build the project.
