import { describe, expect, test } from 'bun:test'

import { TextractClient } from '../../../src/vendors/textract'
import { awsCredentialsFromEnv, textractBucket, textractSourceKey } from '../env'

// IAM: shared AI_TOOLS_AWS_* (not MinIO). Bucket/key are package IT constants.
const aws = awsCredentialsFromEnv()
const bucket = textractBucket()
const sourceKey = textractSourceKey()
const run = aws ? describe : describe.skip

/**
 * Sample object: integration-test-ai-tools/textract/sample.pdf
 * key_prefix IT uses the first path segment as the tenant root so logical
 * ArtifactRef.key is prefix-relative without re-uploading the fixture.
 */
const sampleKeyPrefix = 'integration-test-ai-tools/'
const sampleLogicalKey = 'textract/sample.pdf'

function client(pollMs = 60_000, keyPrefix?: string) {
	return new TextractClient({
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		bucket,
		poll_timeout_ms: pollMs,
		...(keyPrefix !== undefined && { key_prefix: keyPrefix }),
		...(aws!.session_token && { session_token: aws!.session_token })
	})
}

run('live vendor textract', () => {
	test(
		'extractText from S3 object',
		async () => {
			const result = await client().extractText({
				source: { store: 'object', key: sourceKey }
			})
			expect(['succeeded', 'pending', 'failed']).toContain(result.status)
			if (result.status === 'succeeded') {
				expect(typeof result.text === 'string').toBe(true)
			}
		},
		{ timeout: 90_000 }
	)

	test(
		'extractText with key_prefix resolves logical ArtifactRef.key to wire Name',
		async () => {
			// Fixture wire key is integration-test-ai-tools/textract/sample.pdf
			expect(sourceKey).toBe(`${sampleKeyPrefix}${sampleLogicalKey}`)
			const result = await client(60_000, sampleKeyPrefix).extractText({
				source: { store: 'object', key: sampleLogicalKey }
			})
			expect(['succeeded', 'pending', 'failed']).toContain(result.status)
			// Returned source stays logical (not wire-expanded).
			expect(result.source?.key).toBe(sampleLogicalKey)
			if (result.status === 'succeeded') {
				expect(typeof result.text === 'string').toBe(true)
			}
			if (result.status === 'failed') {
				// Prefix mis-resolve would typically be InvalidS3ObjectException.
				expect(result.error ?? '').not.toMatch(/InvalidS3Object/i)
			}
		},
		{ timeout: 90_000 }
	)

	test(
		'extractTextBatch + getStatus when pending job_id',
		async () => {
			const c = client(5_000)
			const batch = await c.extractTextBatch({
				sources: [{ store: 'object', key: sourceKey }]
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
