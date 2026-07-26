import { describe, expect, test } from 'bun:test'

import { DocumentExtractClient } from '../../../src/modules/document-extract'
import { awsCredentialsFromEnv, env } from '../env'

// IAM: shared AI_TOOLS_AWS_* (not MinIO AI_TOOLS_S3_*).
const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_TEXTRACT_REGION' })
const bucket = env('AI_TOOLS_TEXTRACT_BUCKET')
const sourceKey = env('AI_TOOLS_TEXTRACT_SOURCE_KEY')
const run = aws && bucket && sourceKey ? describe : describe.skip

function client(pollMs = 60_000) {
	return DocumentExtractClient.fromAuth({
		provider: 'textract',
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		bucket: bucket!,
		poll_timeout_ms: pollMs,
		...(aws!.session_token && { session_token: aws!.session_token })
	})
}

run('live seam document-extract (textract)', () => {
	test(
		'extractText',
		async () => {
			const result = await client().extractText({
				source: { store: 'object', key: sourceKey! }
			})
			expect(['succeeded', 'pending', 'failed']).toContain(result.status)
		},
		{ timeout: 90_000 }
	)

	test(
		'extractTextBatch + getStatus when pending job_id',
		async () => {
			const c = client(5_000)
			const batch = await c.extractTextBatch({
				sources: [{ store: 'object', key: sourceKey! }]
			})
			expect(batch.results.length).toBe(1)
			expect(batch.succeeded + batch.failed).toBe(1)
			const row = batch.results[0]
			if (row?.ok && row.value) {
				if (row.value.job_id) {
					const polled = await client(60_000).getStatus({ job_id: row.value.job_id })
					expect(['succeeded', 'pending', 'failed']).toContain(polled.status)
				} else {
					// Completed inline — still a full batch path.
					expect(['succeeded', 'pending', 'failed']).toContain(row.value.status)
				}
			}
		},
		{ timeout: 90_000 }
	)
})
