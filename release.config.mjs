/**
 * semantic-release — conventional commits decide the version.
 * CI: .github/workflows/release.yml (OIDC npm Trusted Publisher, no NPM_TOKEN).
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
					{ type: 'feat', release: 'minor' },
					{ type: 'fix', release: 'patch' },
					{ type: 'perf', release: 'patch' },
					{ type: 'refactor', release: 'patch' },
					{ type: 'revert', release: 'patch' },
					{ breaking: true, release: 'major' },
					// Only pure non-product noise stays off the version train
					{ type: 'docs', release: false },
					{ type: 'chore', release: false },
					{ type: 'test', release: false },
					{ type: 'ci', release: false },
					{ type: 'style', release: false },
					{ type: 'build', release: false }
				]
			}
		],
		[
			'@semantic-release/release-notes-generator',
			{
				preset: 'conventionalcommits'
			}
		],
		[
			'@semantic-release/changelog',
			{
				changelogFile: 'CHANGELOG.md',
				changelogTitle:
					'# Changelog\n\nAll notable changes to `@harryy/ai-tools` are documented here.\n\nFormat follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are cut by [semantic-release](https://semantic-release.gitbook.io/) from [conventional commits](https://www.conventionalcommits.org/).'
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
