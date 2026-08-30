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

	test('bounded get omits If-Match for a weak ETag', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '3', etag: 'W/"weak"' }
				})
			}
			expect(req.method).toBe('GET')
			expect(req.headers.get('if-match')).toBeNull()
			return new Response(new Uint8Array([1, 2, 3]), {
				status: 206,
				headers: { 'content-length': '3', 'content-range': 'bytes 0-2/3', etag: 'W/"weak"' }
			})
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			const bytes = await client.getBytes('weak.bin', { maxBytes: 10 })
			expect([...bytes]).toEqual([1, 2, 3])
		} finally {
			globalThis.fetch = original
		}
	})

	test('bounded get refreshes metadata and retries one precondition failure', async () => {
		const original = globalThis.fetch
		let heads = 0
		let gets = 0
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				heads += 1
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '3', etag: heads === 1 ? '"v1"' : '"v2"' }
				})
			}
			gets += 1
			expect(req.headers.get('if-match')).toBe(gets === 1 ? '"v1"' : '"v2"')
			if (gets === 1) return new Response('changed', { status: 412 })
			return new Response(new Uint8Array([4, 5, 6]), {
				status: 206,
				headers: { 'content-length': '3', 'content-range': 'bytes 0-2/3', etag: '"v2"' }
			})
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			const bytes = await client.getBytes('changed.bin', { maxBytes: 10 })
			expect([...bytes]).toEqual([4, 5, 6])
			expect(heads).toBe(2)
			expect(gets).toBe(2)
		} finally {
			globalThis.fetch = original
		}
	})

	test('range get refreshes metadata and retries one precondition failure', async () => {
		const original = globalThis.fetch
		let heads = 0
		let gets = 0
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				heads += 1
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '3', etag: heads === 1 ? '"v1"' : '"v2"' }
				})
			}
			gets += 1
			expect(req.headers.get('range')).toBe('bytes=0-2')
			expect(req.headers.get('if-match')).toBe(gets === 1 ? '"v1"' : '"v2"')
			if (gets === 1) return new Response('changed', { status: 412 })
			return new Response(new Uint8Array([7, 8, 9]), {
				status: 206,
				headers: { 'content-length': '3', 'content-range': 'bytes 0-2/3', etag: '"v2"' }
			})
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			const ranged = await client.getBytesRange('changed.bin', { start_byte: 0, end_byte: 2 })
			expect([...ranged.bytes]).toEqual([7, 8, 9])
			expect(heads).toBe(2)
			expect(gets).toBe(2)
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

	test('bounded get returns an empty object without an unsatisfiable Range request', async () => {
		const original = globalThis.fetch
		let gets = 0
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '0', 'content-type': 'application/octet-stream', etag: '"empty"' }
				})
			}
			if (req.method === 'GET') gets += 1
			return new Response('unexpected', { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			const result = await client.get({ key: 'empty.bin', encoding: 'base64' })
			expect(result).toEqual({
				key: 'empty.bin',
				body: '',
				encoding: 'base64',
				content_type: 'application/octet-stream',
				content_length: 0
			})
			expect(gets).toBe(0)
		} finally {
			globalThis.fetch = original
		}
	})

	test('bounded get rejects a larger Content-Range even when the returned chunk is small', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'HEAD') {
				return new Response(null, { status: 200, headers: { 'content-length': '1' } })
			}
			return new Response(new Uint8Array(5), {
				status: 206,
				headers: { 'content-length': '5', 'content-range': 'bytes 0-4/20' }
			})
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client(auth)
			await client.getBytes('grew.bin', { maxBytes: 10 })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) {
				expect(error.code).toBe('too_large')
				expect(error.details?.['content_length']).toBe(20)
			}
		} finally {
			globalThis.fetch = original
		}
	})

	test('getBytes rejects invalid limits before network I/O', async () => {
		let fetched = false
		const client = new S3Client(auth, {
			fetch: async () => {
				fetched = true
				return new Response()
			}
		})

		expect(client.getBytes('x', { maxBytes: Number.NaN })).rejects.toMatchObject({ code: 'bad_input' })
		expect(fetched).toBe(false)
	})

	test('key_prefix: put/get/delete/head/list/signedUrl use wire keys and return logical keys', async () => {
		const original = globalThis.fetch
		const seen: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			seen.push(`${req.method} ${req.url}`)
			if (req.method === 'GET' && req.url.includes('list-type=2')) {
				const url = new URL(req.url)
				expect(url.searchParams.get('prefix')).toBe('tenants/acme/')
				return new Response(
					`<?xml version="1.0"?><ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>tenants/acme/docs/a.txt</Key><Size>1</Size></Contents>
  <CommonPrefixes><Prefix>tenants/acme/docs/sub/</Prefix></CommonPrefixes>
</ListBucketResult>`,
					{ status: 200, headers: { 'content-type': 'application/xml' } }
				)
			}
			if (req.method === 'PUT' && req.url.includes('tenants/acme/docs/a.txt')) {
				return new Response(null, { status: 200, headers: { etag: '"e1"' } })
			}
			if (req.method === 'HEAD' && req.url.includes('tenants/acme/docs/a.txt')) {
				return new Response(null, {
					status: 200,
					headers: { 'content-type': 'text/plain', 'content-length': '1', etag: '"e1"' }
				})
			}
			if (req.method === 'GET' && req.url.includes('tenants/acme/docs/a.txt')) {
				return new Response('x', {
					status: 206,
					headers: {
						'content-type': 'text/plain',
						'content-length': '1',
						'content-range': 'bytes 0-0/1',
						etag: '"e1"'
					}
				})
			}
			if (req.method === 'DELETE' && req.url.includes('tenants/acme/docs/a.txt')) {
				return new Response(null, { status: 204 })
			}
			return new Response(`unexpected ${req.method} ${req.url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client({ ...auth, key_prefix: 'tenants/acme' })
			const listed = await client.list({})
			expect(listed.keys).toEqual(['docs/a.txt'])
			expect(listed.common_prefixes).toEqual(['docs/sub/'])

			const put = await client.put({ key: 'docs/a.txt', body: 'x', body_encoding: 'utf8' })
			expect(put.key).toBe('docs/a.txt')

			const head = await client.head({ key: 'docs/a.txt' })
			expect(head).toMatchObject({ key: 'docs/a.txt', exists: true, content_length: 1 })

			const got = await client.get({ key: 'docs/a.txt', encoding: 'utf8' })
			expect(got).toMatchObject({ key: 'docs/a.txt', body: 'x' })

			// Already-prefixed logical key still works; no double-prefix on wire.
			const gotPrefixed = await client.get({ key: 'tenants/acme/docs/a.txt', encoding: 'utf8' })
			expect(gotPrefixed.key).toBe('docs/a.txt')

			const del = await client.delete({ key: 'docs/a.txt' })
			expect(del.key).toBe('docs/a.txt')

			const signed = await client.createSignedUrl({ key: 'docs/a.txt', expires_in: 60 })
			expect(signed.url).toContain('tenants/acme/docs/a.txt')
			expect(seen.some((line) => line.includes('tenants/acme/docs/a.txt'))).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('key_prefix: raw byte APIs and multipart resolve once (no double prefix via head)', async () => {
		const original = globalThis.fetch
		const urls: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			urls.push(req.url)
			if (req.method === 'PUT' && !req.url.includes('partNumber') && !req.url.includes('uploadId')) {
				// putBytes
				expect(req.url).toContain('tenants/acme/raw.bin')
				expect(req.url).not.toContain('tenants/acme/tenants/acme')
				return new Response(null, { status: 200 })
			}
			if (req.method === 'HEAD') {
				expect(req.url).toContain('tenants/acme/raw.bin')
				expect(req.url).not.toContain('tenants/acme/tenants/acme')
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '3', etag: '"r1"' }
				})
			}
			if (req.method === 'GET' && req.headers.get('range')) {
				return new Response(new Uint8Array([1, 2, 3]), {
					status: 206,
					headers: { 'content-length': '3', 'content-range': 'bytes 0-2/3', etag: '"r1"' }
				})
			}
			if (req.method === 'POST' && req.url.includes('uploads')) {
				expect(req.url).toContain('tenants/acme/big.bin')
				return new Response(
					'<InitiateMultipartUploadResult><UploadId>up-1</UploadId></InitiateMultipartUploadResult>',
					{ status: 200 }
				)
			}
			if (req.method === 'PUT' && req.url.includes('partNumber')) {
				return new Response(null, { status: 200, headers: { etag: '"p1"' } })
			}
			if (req.method === 'POST' && req.url.includes('uploadId=')) {
				return new Response('<CompleteMultipartUploadResult><ETag>"final"</ETag></CompleteMultipartUploadResult>', {
					status: 200
				})
			}
			if (req.method === 'DELETE' && req.url.includes('uploadId=')) {
				return new Response(null, { status: 204 })
			}
			return new Response(`unexpected ${req.method} ${req.url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client({ ...auth, key_prefix: 'tenants/acme/' })
			await client.putBytes('raw.bin', new Uint8Array([1, 2, 3]), 'application/octet-stream')
			const bytes = await client.getBytes('raw.bin', { maxBytes: 10 })
			expect(bytes.byteLength).toBe(3)
			const ranged = await client.getBytesRange('raw.bin', { start_byte: 0, end_byte: 2 })
			expect(ranged.bytes.byteLength).toBe(3)

			const started = await client.createMultipartUpload({ key: 'big.bin' })
			expect(started.key).toBe('big.bin')
			const part = await client.uploadPart({
				key: 'big.bin',
				upload_id: started.upload_id,
				part_number: 1,
				body: 'part-body-data!!',
				body_encoding: 'utf8'
			})
			expect(part.key).toBe('big.bin')
			const completed = await client.completeMultipartUpload({
				key: 'big.bin',
				upload_id: started.upload_id,
				parts: [{ part_number: 1, etag: part.etag }]
			})
			expect(completed.key).toBe('big.bin')
			const aborted = await client.abortMultipartUpload({ key: 'big.bin', upload_id: 'up-x' })
			expect(aborted.key).toBe('big.bin')

			for (const url of urls) {
				expect(url).not.toContain('tenants/acme/tenants/acme')
			}
		} finally {
			globalThis.fetch = original
		}
	})

	test('key_prefix: copy scopes destination always; source only for same bucket', async () => {
		const original = globalThis.fetch
		const copySources: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'PUT') {
				copySources.push(req.headers.get('x-amz-copy-source') ?? '')
				expect(req.url).toContain('tenants/acme/dst.txt')
				return new Response('<CopyObjectResult><ETag>"c1"</ETag></CopyObjectResult>', { status: 200 })
			}
			return new Response('unexpected', { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new S3Client({ ...auth, key_prefix: 'tenants/acme/' })

			const same = await client.copy({ source_key: 'src.txt', destination_key: 'dst.txt' })
			expect(same.source_key).toBe('src.txt')
			expect(same.destination_key).toBe('dst.txt')
			expect(decodeURIComponent(copySources[0] ?? '')).toContain('/demo/tenants/acme/src.txt')

			const foreign = await client.copy({
				source_key: 'foreign/path.txt',
				destination_key: 'dst.txt',
				source_bucket: 'other-bucket'
			})
			expect(foreign.source_key).toBe('foreign/path.txt')
			expect(foreign.destination_key).toBe('dst.txt')
			expect(decodeURIComponent(copySources[1] ?? '')).toContain('/other-bucket/foreign/path.txt')
			expect(decodeURIComponent(copySources[1] ?? '')).not.toContain('tenants/acme/foreign')
		} finally {
			globalThis.fetch = original
		}
	})

	test('without key_prefix behavior is unchanged (absolute keys pass through)', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			if (req.method === 'PUT') {
				// Virtual-hosted–style URL: https://demo.s3.region.amazonaws.com/top-level.txt
				expect(req.url).toContain('demo.s3.')
				expect(req.url).toContain('top-level.txt')
				expect(req.url).not.toContain('tenants/')
				return new Response(null, { status: 200, headers: { etag: '"t"' } })
			}
			return new Response('unexpected', { status: 500 })
		}) as typeof globalThis.fetch
		try {
			const client = new S3Client(auth)
			const put = await client.put({ key: 'top-level.txt', body: 'z' })
			expect(put.key).toBe('top-level.txt')
		} finally {
			globalThis.fetch = original
		}
	})
})
