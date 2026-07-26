import { describe, expect, test } from 'bun:test'

import { ArtifactsClient } from '../../../src/modules/artifacts'
import { S3Client } from '../../../src/vendors/s3'
import { s3AuthFromEnv, uniqueId } from '../env'

const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = storage ? describe : describe.skip

run('live seam artifacts', () => {
	test(
		'create and bounded byte/line reads',
		async () => {
			const key = `ai-tools-artifacts-it/${uniqueId('artifact')}.txt`
			const client = ArtifactsClient.fromAuth({
				provider: 'object',
				storage: { ...storage! }
			})
			const cleanup = new S3Client(storage!)

			try {
				const created = await client.create({
					key,
					body: 'alpha\nbeta\ngamma',
					encoding: 'utf8',
					media_type: 'text/plain'
				})
				expect(created.artifact.store).toBe('object')

				const range = await client.readRange({
					source: created.artifact,
					start_byte: 6,
					end_byte: 9
				})
				expect(Buffer.from(range.body_base64, 'base64').toString('utf8')).toBe('beta')

				const lines = await client.readLines({
					source: created.artifact,
					start_line: 2,
					end_line: 3
				})
				expect(lines.text).toBe('beta\ngamma')
			} finally {
				await cleanup.delete({ key }).catch(() => undefined)
			}
		},
		{ timeout: 60_000 }
	)
})
