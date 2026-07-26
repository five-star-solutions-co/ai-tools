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
			if (req.method === 'HEAD' && req.url.includes('hello.txt')) {
				return new Response(null, {
					status: 200,
					headers: { 'content-type': 'text/plain', 'content-length': '5', etag: '"abc"' }
				})
			}
			if (req.method === 'GET' && req.url.includes('hello.txt')) {
				// Bounded get always sends Range (+ If-Match when HEAD returned etag).
				expect(req.headers.get('range')?.startsWith('bytes=0-')).toBe(true)
				expect(req.headers.get('if-match')).toBe('"abc"')
				return new Response('hello', {
					status: 206,
					headers: {
						'content-type': 'text/plain',
						'content-length': '5',
						'content-range': 'bytes 0-4/5',
						etag: '"abc"'
					}
				})
			}
			if ((req.method === 'HEAD' || req.method === 'GET') && req.url.includes('missing')) {
				return new Response('nope', { status: 404 })
			}
			return new Response(`unexpected ${req.method}`, { status: 500 })
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

	test('getBytes maxBytes uses Range so concurrent grow cannot fully buffer', async () => {
		const original = globalThis.fetch
		let getBodyBytes = 0
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '1', etag: '"v1"' }
				})
			}
			if (req.method === 'GET') {
				expect(req.headers.get('if-match')).toBe('"v1"')
				const range = req.headers.get('range')
				expect(range).toBe('bytes=0-10')
				// Simulate object that grew past the HEAD length; only serve the Range window.
				const payload = new Uint8Array(11).fill(7)
				getBodyBytes = payload.byteLength
				return new Response(payload, {
					status: 206,
					headers: {
						'content-length': '11',
						'content-range': 'bytes 0-10/6000000',
						etag: '"v1"'
					}
				})
			}
			return new Response('unexpected', { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			try {
				await client.getBytes('big.bin', { maxBytes: 10 })
				expect.unreachable()
			} catch (error) {
				expect(isToolError(error)).toBe(true)
				if (isToolError(error)) {
					expect(error.code).toBe('too_large')
					expect(error.details?.['max_bytes']).toBe(10)
				}
			}
			// Never buffered the full 6 MiB object — only the Range probe window.
			expect(getBodyBytes).toBe(11)
		} finally {
			globalThis.fetch = original
		}
	})

	test('getBytes maxBytes rejects oversized HEAD without GET body', async () => {
		const original = globalThis.fetch
		let gets = 0
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': String(20 * 1024 * 1024), etag: '"huge"' }
				})
			}
			if (req.method === 'GET') {
				gets += 1
				return new Response(new Uint8Array(8), { status: 200 })
			}
			return new Response('unexpected', { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			try {
				await client.getBytes('huge.bin', { maxBytes: 1024 })
				expect.unreachable()
			} catch (error) {
				expect(isToolError(error)).toBe(true)
				if (isToolError(error)) expect(error.code).toBe('too_large')
			}
			expect(gets).toBe(0)
		} finally {
			globalThis.fetch = original
		}
	})
})
