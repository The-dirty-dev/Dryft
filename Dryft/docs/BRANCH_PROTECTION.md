# Branch Protection Recommendations (main)

These are recommended settings for protecting the `main` branch in GitHub.

## Required
1. Require a pull request before merging.
2. Require at least 1 approval (2 for sensitive changes).
3. Require status checks to pass before merging.
4. Require branches to be up to date before merging.
5. Require conversation resolution before merging.
6. Do not allow force pushes.
7. Do not allow branch deletions.
8. Include administrators.

## Recommended Checks
- CI
- CodeQL
- Dependency Review
- Security Scan (Snyk)
- Performance Regression Check

## Optional
1. Require linear history.
2. Require signed commits.
3. Require merge queue for high-traffic periods.

## Notes
- Ensure required checks match current workflow names in `.github/workflows/`.
- If a workflow is optional, do not mark it as required.
