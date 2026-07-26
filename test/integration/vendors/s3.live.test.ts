import { describe, expect, test } from 'bun:test'

import { S3Client } from '../../../src/vendors/s3'
import { objectKey, s3AuthFromEnv } from '../helpers'

const auth = s3AuthFromEnv('AI_TOOLS_S3')
const run = auth ? describe : describe.skip

run('live vendor s3', () => {
	test('list put get head copy delete putBytes getBytes', async () => {
		const client = new S3Client(auth!)
		const key = objectKey('ai-tools-s3')
		const copyKey = `${key}.copy`

		await client.put({
			key,
			body: 'hello s3 integration',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const listed = await client.list({ prefix: key.slice(0, key.lastIndexOf('/')), limit: 50 })
		expect(Array.isArray(listed.items)).toBe(true)

		const got = await client.get({ key })
		expect(got.body).toBeTruthy()

		const head = await client.head({ key })
		expect(head.key).toBe(key)

		await client.copy({ source_key: key, destination_key: copyKey })
		const copyGot = await client.get({ key: copyKey })
		expect(copyGot.body).toBeTruthy()

		const bytesKey = objectKey('ai-tools-s3-bytes')
		await client.putBytes(bytesKey, new TextEncoder().encode('bytes'), 'text/plain')
		const raw = await client.getBytes(bytesKey)
		expect(raw.byteLength).toBeGreaterThan(0)

		// getBytesRange (added for artifacts bounded reads)
		const rangeKey = objectKey('ai-tools-s3-range')
		await client.putBytes(rangeKey, new TextEncoder().encode('0123456789'), 'text/plain')
		const ranged = await client.getBytesRange(rangeKey, { start_byte: 2, end_byte: 5 })
		expect(new TextDecoder().decode(ranged.bytes)).toBe('2345')
		expect(ranged.start_byte).toBe(2)
		expect(ranged.end_byte).toBe(5)

		await client.delete({ key })
		await client.delete({ key: copyKey })
		await client.delete({ key: bytesKey })
		await client.delete({ key: rangeKey })
	})

	test('createSignedUrl get', async () => {
		const client = new S3Client(auth!)
		const key = objectKey('ai-tools-s3-sign')
		await client.put({
			key,
			body: 'signed',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const signed = await client.createSignedUrl({ key, method: 'GET', expires_in: 120 })
		expect(signed.url).toContain('http')
		const res = await fetch(signed.url)
		expect(res.ok).toBe(true)
		await client.delete({ key })
	})

	test('multipart upload complete', async () => {
		const client = new S3Client(auth!)
		const key = objectKey('ai-tools-s3-mp')
		// MinIO: two parts as base64 (S3 client only accepts string body)
		const partA = Buffer.alloc(5 * 1024 * 1024, 1)
		const partB = Buffer.alloc(1024, 2)
		const started = await client.createMultipartUpload({ key, content_type: 'application/octet-stream' })
		expect(started.upload_id).toBeTruthy()
		const uploadedA = await client.uploadPart({
			key,
			upload_id: started.upload_id,
			part_number: 1,
			body: partA.toString('base64'),
			body_encoding: 'base64'
		})
		const uploadedB = await client.uploadPart({
			key,
			upload_id: started.upload_id,
			part_number: 2,
			body: partB.toString('base64'),
			body_encoding: 'base64'
		})
		await client.completeMultipartUpload({
			key,
			upload_id: started.upload_id,
			parts: [
				{ part_number: 1, etag: uploadedA.etag },
				{ part_number: 2, etag: uploadedB.etag }
			]
		})
		const got = await client.getBytes(key)
		expect(got.byteLength).toBe(partA.byteLength + partB.byteLength)
		await client.delete({ key })
	})

	test('multipart abort', async () => {
		const client = new S3Client(auth!)
		const key = objectKey('ai-tools-s3-mp-abort')
		const started = await client.createMultipartUpload({ key })
		await client.abortMultipartUpload({ key, upload_id: started.upload_id })
		expect(started.upload_id).toBeTruthy()
	})
})
