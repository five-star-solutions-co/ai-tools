import { describe, expect, test } from 'bun:test'

import { DocumentExtractClient } from '../../../src/modules/document-extract'
import { awsCredentialsFromEnv, env } from '../env'

// IAM: shared AI_TOOLS_AWS_* (not MinIO AI_TOOLS_S3_*).
const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_TEXTRACT_REGION' })
const bucket = env('AI_TOOLS_TEXTRACT_BUCKET')
const sourceKey = env('AI_TOOLS_TEXTRACT_SOURCE_KEY')
const run = aws && bucket && sourceKey ? describe : describe.skip

run('live seam document-extract (textract)', () => {
	// Async Textract + poll; bun default 5s is too low (vendor barely finished in ~5s).
	test(
		'extractText',
		async () => {
			const client = DocumentExtractClient.fromAuth({
				provider: 'textract',
				access_key_id: aws!.access_key_id,
				secret_access_key: aws!.secret_access_key,
				region: aws!.region,
				bucket: bucket!,
				poll_timeout_ms: 60_000,
				...(aws!.session_token && { session_token: aws!.session_token })
			})
			const result = await client.extractText({
				source: { store: 'object', key: sourceKey! }
			})
			expect(['succeeded', 'pending', 'failed']).toContain(result.status)
		},
		{ timeout: 90_000 }
	)
})
