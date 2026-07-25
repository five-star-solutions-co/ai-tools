import { describe, expect, test } from 'bun:test'

import { isToolError, validateModule } from '../../src/core'
import { S3Client, s3Module } from '../../src/vendors/s3'
import { firstXmlText, parseListResult } from '../../src/vendors/s3/domain'

const auth = {
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	bucket: 'demo'
} as const

describe('s3', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(s3Module).ok).toBe(true)
		expect(s3Module.auth.type).toBe('custom')
		expect(s3Module.tools.map((t) => t.id).sort()).toEqual([
			's3-abort-multipart-upload',
			's3-complete-multipart-upload',
			's3-copy-object',
			's3-create-multipart-upload',
			's3-create-signed-url',
			's3-delete-object',
			's3-get-object',
			's3-head-object',
			's3-list-objects',
			's3-put-object',
			's3-upload-part'
		])
	})

	test('invalid auth rejected at construct', () => {
		expect(() => new S3Client({ ...auth, access_key_id: '' })).toThrow()
	})

	test('parseListResult maps Contents and CommonPrefixes', () => {
		const listed = parseListResult(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>tok-2</NextContinuationToken>
  <Contents>
    <Key>a/file.pdf</Key>
    <Size>12</Size>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>&quot;abc&quot;</ETag>
  </Contents>
  <Contents>
    <Key>b.txt</Key>
    <Size>0</Size>
  </Contents>
  <CommonPrefixes>
    <Prefix>folder/</Prefix>
  </CommonPrefixes>
</ListBucketResult>`)
		expect(listed.truncated).toBe(true)
		expect(listed.next_cursor).toBe('tok-2')
		expect(listed.common_prefixes).toEqual(['folder/'])
		expect(listed.items).toEqual([
			{
				key: 'a/file.pdf',
				size: 12,
				last_modified: '2024-01-01T00:00:00.000Z',
				etag: 'abc'
			},
			{ key: 'b.txt', size: 0 }
		])
		expect(
			firstXmlText(
				'<InitiateMultipartUploadResult><UploadId>uid-1</UploadId></InitiateMultipartUploadResult>',
				'UploadId'
			)
		).toBe('uid-1')
	})

	test('list and get use AwsService-signed fetch (no raw AwsClient)', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			expect(req.headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256')).toBe(true)
			if (req.method === 'GET' && req.url.includes('list-type=2')) {
				const xml = `<?xml version="1.0"?><ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>hello.txt</Key><Size>5</Size></Contents>
</ListBucketResult>`
				return new Response(xml, {
					status: 200,
					headers: { 'content-type': 'application/xml' }
				})
			}
			if (req.method === 'GET' && req.url.includes('hello.txt')) {
				return new Response('hello', {
					status: 200,
					headers: { 'content-type': 'text/plain', 'content-length': '5' }
				})
			}
			if (req.method === 'GET' && req.url.includes('missing')) {
				return new Response('nope', { status: 404 })
			}
			return new Response('unexpected', { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			const listed = await client.list({})
			expect(listed.keys).toEqual(['hello.txt'])
			const got = await client.get({ key: 'hello.txt', encoding: 'utf8' })
			expect(got.body).toBe('hello')
			expect(got.content_type).toBe('text/plain')
			try {
				await client.get({ key: 'missing' })
				expect.unreachable()
			} catch (error) {
				expect(isToolError(error)).toBe(true)
				if (isToolError(error)) {
					expect(error.code).toBe('not_found')
					expect(error.message).toBe('Object not found')
				}
			}
			const signed = await client.createSignedUrl({ key: 'hello.txt', expires_in: 60 })
			expect(signed.url).toContain('X-Amz-Signature=')
			expect(signed.method).toBe('GET')
			expect(signed.expires_in).toBe(60)
		} finally {
			globalThis.fetch = original
		}
	})
})
