# Contributing

For deployments, change your instance only. For core contributions, use a branch, keep examples neutral and add tests for changed behavior. Do not commit real service responses, private hosts, credentials or copied project assets. Synthetic fixtures and public demonstration data keep tests reproducible.

Install with `npm ci` and `npx playwright install chromium`. Run `npm run check`; browser tests substitute remote services. Run `npm run reference` after schema changes, `npm run screenshots` after visible UI changes and `npm run notices` after production dependency changes. Review generated notices and required public license contacts before updating the scanner allowance. Keep config examples valid JSON and record service-dependent checks that could not run.

Open an issue or pull request with the concrete problem, resulting behavior and validation. Avoid personal or internal details. Read CODE_OF_CONDUCT.md and SECURITY.md.
