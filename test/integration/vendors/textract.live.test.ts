import { describe, expect, test } from 'bun:test'

import { TextractClient } from '../../../src/vendors/textract'
import { awsCredentialsFromEnv, env } from '../env'

// IAM: shared AI_TOOLS_AWS_* (not MinIO AI_TOOLS_S3_*).
const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_TEXTRACT_REGION' })
const bucket = env('AI_TOOLS_TEXTRACT_BUCKET')
const sourceKey = env('AI_TOOLS_TEXTRACT_SOURCE_KEY')
const run = aws && bucket && sourceKey ? describe : describe.skip

function client(pollMs = 60_000) {
	return new TextractClient({
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		bucket: bucket!,
		poll_timeout_ms: pollMs,
		...(aws!.session_token && { session_token: aws!.session_token })
	})
}

run('live vendor textract', () => {
	test(
		'extractText from S3 object',
		async () => {
			const result = await client().extractText({
				source: { store: 'object', key: sourceKey! }
			})
			expect(['succeeded', 'pending', 'failed']).toContain(result.status)
			if (result.status === 'succeeded') {
				expect(typeof result.text === 'string').toBe(true)
			}
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
			if (row?.ok && row.value?.job_id) {
				const polled = await client(60_000).getStatus({ job_id: row.value.job_id })
				expect(['succeeded', 'pending', 'failed']).toContain(polled.status)
			}
		},
		{ timeout: 90_000 }
	)
})
