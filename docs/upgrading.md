# Updating core

Instance changes belong only in `app/**` and ignored environment files. Commit or stash all changes before `npm run update-core -- v0.1.0`. The tool ensures an `upstream` remote, fetches tags, resolves the requested version and restores managed paths from it into both index and working tree. Removed upstream files are removed locally. Review the staged diff before committing.

Managed paths: `src/`, `tools/`, `skills/`, `docs/`, `examples/`, `tests/`, `.claude-plugin/`, `index.html`, `vite.config.js`, `eslint.config.js`, `jsconfig.json`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`. `app/`, `.env`, README and LICENSE remain unchanged. `package.json` and its lock are preserved; the tool prints dependency/script differences for deliberate reconciliation. Root CI/editor settings are also reviewed manually.

Read the release's changelog, apply required package changes, run `npm install` to update the lock when needed, validate your instance and run relevant browser checks. Keep backups or commits of your instance. The updater stages changes but does not merge, commit or publish them. Its integration test verifies deletion of obsolete core files and preservation of app/environment/readme/license/package data.
