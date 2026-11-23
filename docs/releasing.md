# Release a kit version

Run `npm run release-version -- <version>` to synchronize `package.json`, the lockfile, Claude plugin metadata, the skill `VERSION` tag and its `ENGINES.json`. The release consistency unit test fails when any of these disagree. Add the corresponding CHANGELOG entry and run the maintainer checks with the appropriate private leak denylist before committing/tagging.

For independent bootstrap testing before the final release, use a release candidate such as `0.2.0-rc.1`, commit it and create that annotated local tag. The installed skill then clones the exact tested version from an authorized local source. Keep previous candidates; corrections use a new candidate tag. After acceptance, synchronize the final version, run checks, commit, create the final annotated tag and push `main` and that tag without force. Source GitHub access and platform-specific CI still need to be checked separately.
