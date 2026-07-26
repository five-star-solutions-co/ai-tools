import { describe, expect, test } from 'bun:test'

import { FileConvertClient } from '../../../src/modules/file-convert'
import { S3Client } from '../../../src/vendors/s3'
import { env, objectKey, s3AuthFromEnv } from '../helpers'

const baseUrl = env('AI_TOOLS_GOTENBERG_BASE_URL')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = baseUrl && storage ? describe : describe.skip

run('live seam file-convert (gotenberg libreoffice)', () => {
	test('office-to-pdf converts plain text as office-ish payload when LO accepts', async () => {
		const s3 = new S3Client(storage!)
		const sourceKey = objectKey('file-convert-src')
		// Minimal RTF is widely accepted by LibreOffice
		const rtf = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs24 Hello convert.\\par}'
		await s3.put({
			key: sourceKey,
			body: rtf,
			body_encoding: 'utf8',
			content_type: 'application/rtf'
		})

		const client = FileConvertClient.fromAuth({
			provider: 'gotenberg',
			gotenberg_base_url: baseUrl!,
			storage: storage!,
			...(env('AI_TOOLS_GOTENBERG_USER')
				? {
						gotenberg_api_username: env('AI_TOOLS_GOTENBERG_USER')!,
						gotenberg_api_password: env('AI_TOOLS_GOTENBERG_PASSWORD')!
					}
				: {})
		})

		const out = await client.convert({
			source: {
				store: 'object',
				key: sourceKey,
				filename: 'hello.rtf',
				media_type: 'application/rtf'
			},
			path: 'office-to-pdf'
		})

		expect(out.path).toBe('office-to-pdf')
		expect(out.result.store).toBe('object')
		expect(out.result.media_type).toBe('application/pdf')
		expect(out.result.key.endsWith('.pdf')).toBe(true)
		expect((out.result.byte_length ?? 0) > 0).toBe(true)
	})
})
