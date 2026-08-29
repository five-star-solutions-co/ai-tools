/**
 * semantic-release — every commit since the last tag cuts a release.
 * feat → minor, BREAKING CHANGE / type! → major, everything else → patch.
 * CI: .github/workflows/release.yml (OIDC npm Trusted Publisher, no NPM_TOKEN).
 * The workflow still skips the bot chore(release)/[skip ci] commit so that
 * push cannot loop; it is not a product-commit filter.
 *
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
	branches: ['main'],
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				preset: 'conventionalcommits',
				releaseRules: [
					{ breaking: true, release: 'major' },
					{ type: 'feat', release: 'minor' },
					// Match any remaining commit (typed or not). Highest type wins.
					{ release: 'patch' }
				]
			}
		],
		[
			'@semantic-release/release-notes-generator',
			{
				preset: 'conventionalcommits',
				presetConfig: {
					types: [
						{ type: 'feat', section: 'Features' },
						{ type: 'fix', section: 'Bug Fixes' },
						{ type: 'perf', section: 'Performance Improvements' },
						{ type: 'revert', section: 'Reverts' },
						{ type: 'refactor', section: 'Code Refactoring' },
						{ type: 'docs', section: 'Documentation' },
						{ type: 'style', section: 'Styles' },
						{ type: 'chore', section: 'Miscellaneous' },
						{ type: 'test', section: 'Tests' },
						{ type: 'build', section: 'Build System' },
						{ type: 'ci', section: 'Continuous Integration' }
					]
				}
			}
		],
		[
			'@semantic-release/changelog',
			{
				changelogFile: 'CHANGELOG.md',
				changelogTitle:
					'# Changelog\n\nAll notable changes to `@5ss/ai-tools` are documented here.\n\nFormat follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are cut by [semantic-release](https://semantic-release.gitbook.io/) on every push to `main`.'
			}
		],
		[
			'@semantic-release/npm',
			{
				npmPublish: true
			}
		],
		[
			'@semantic-release/git',
			{
				assets: ['package.json', 'CHANGELOG.md'],
				message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
			}
		],
		'@semantic-release/github'
	]
}
