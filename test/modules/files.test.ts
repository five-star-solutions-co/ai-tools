import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { filesModule } from '../../src/modules/files'
import { normalizeRootPrefix, resolveUnderRoot, toRelativeKey } from '../../src/modules/files/path'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('files path helpers', () => {
	test('normalizes root and resolves relative keys', () => {
		expect(normalizeRootPrefix('orgs/acme/files')).toBe('orgs/acme/files/')
		expect(resolveUnderRoot('orgs/acme/files/', 'docs/a.md')).toBe('orgs/acme/files/docs/a.md')
		expect(toRelativeKey('orgs/acme/files/', 'orgs/acme/files/docs/a.md')).toBe('docs/a.md')
		expect(toRelativeKey('orgs/acme/files/', 'other/x')).toBeUndefined()
	})

	test('rejects path escape', () => {
		expect(() => resolveUnderRoot('orgs/acme/files/', '../secret')).toThrow()
		expect(() => normalizeRootPrefix('../nope')).toThrow()
	})

	test('allows double-dot in a file name segment', () => {
		expect(resolveUnderRoot('workspace/', 'report..final.pdf')).toBe('workspace/report..final.pdf')
	})
})

describe('files + storage key_prefix stacking', () => {
	test('files.root_prefix sits under storage.key_prefix on the wire', async () => {
		const bound = withAuth(filesModule, {
			root_prefix: 'workspace/',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com',
				key_prefix: 'tenants/acme/'
			}
		})
		const putTool = bound.tools.find((t) => t.id === 'files-put')
		const listTool = bound.tools.find((t) => t.id === 'files-list')
		if (!putTool || !listTool) throw new Error('missing tools')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			if (method === 'PUT') {
				expect(decodeURIComponent(url)).toContain('tenants/acme/workspace/notes/a.txt')
				expect(decodeURIComponent(url)).not.toContain('tenants/acme/tenants/acme')
				return new Response(null, { status: 200, headers: { etag: '"f1"' } })
			}
			if (method === 'GET' && (url.includes('list-type=2') || url.includes('prefix='))) {
				const parsed = new URL(url)
				expect(parsed.searchParams.get('prefix')).toBe('tenants/acme/workspace/')
				return new Response(
					`<?xml version="1.0"?>
					<ListBucketResult>
						<Contents><Key>tenants/acme/workspace/notes/a.txt</Key><Size>5</Size></Contents>
						<IsTruncated>false</IsTruncated>
					</ListBucketResult>`,
					{ status: 200 }
				)
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const put = asRecord(await runTool(putTool, { path: 'notes/a.txt', body: 'hello' }))
			expect(put['path']).toBe('notes/a.txt')
			const list = asRecord(await runTool(listTool, {}))
			const items = list['items']
			expect(Array.isArray(items)).toBe(true)
			if (Array.isArray(items)) {
				const paths = items.map((i) => (isPlainObject(i) ? i['path'] : undefined))
				expect(paths).toContain('notes/a.txt')
			}
		} finally {
			globalThis.fetch = original
		}
	})
})

describe('files module', () => {
	test('passes contracts', () => {
		expect(validateModule(filesModule).ok).toBe(true)
		expect(filesModule.tools.map((t) => t.id).sort()).toEqual([
			'files-copy',
			'files-delete',
			'files-get',
			'files-list',
			'files-mkdir',
			'files-move',
			'files-multipart-abort',
			'files-multipart-complete',
			'files-multipart-start',
			'files-multipart-upload-part',
			'files-put',
			'files-search',
			'files-stat'
		])
	})

	test('lists relative paths under root_prefix', async () => {
		const bound = withAuth(filesModule, {
			root_prefix: 'orgs/acme/files/',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const listTool = bound.tools.find((t) => t.id === 'files-list')
		if (!listTool) throw new Error('missing list tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			if (method === 'GET' && (url.includes('list-type=2') || url.includes('prefix='))) {
				expect(decodeURIComponent(url)).toContain('orgs/acme/files/')
				return new Response(
					`<?xml version="1.0"?>
					<ListBucketResult>
						<Contents><Key>orgs/acme/files/docs/a.md</Key><Size>3</Size><ETag>&quot;x&quot;</ETag></Contents>
						<CommonPrefixes><Prefix>orgs/acme/files/docs/sub/</Prefix></CommonPrefixes>
						<IsTruncated>false</IsTruncated>
					</ListBucketResult>`,
					{ status: 200 }
				)
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(await runTool(listTool, { path: 'docs' }))
			expect(result['truncated']).toBe(false)
			const items = result['items']
			expect(Array.isArray(items)).toBe(true)
			if (Array.isArray(items)) {
				const paths = items.map((i) => (isPlainObject(i) ? i['path'] : undefined))
				expect(paths).toContain('docs/a.md')
				expect(paths).toContain('docs/sub')
			}
		} finally {
			globalThis.fetch = original
		}
	})

	test('stats a relative file', async () => {
		const bound = withAuth(filesModule, {
			root_prefix: 'orgs/acme/files/',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const statTool = bound.tools.find((t) => t.id === 'files-stat')
		if (!statTool) throw new Error('missing stat tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			if (method === 'HEAD' && decodeURIComponent(url).includes('orgs/acme/files/docs/a.md')) {
				return new Response(null, {
					status: 200,
					headers: { 'content-type': 'text/markdown', 'content-length': '3', etag: '"abc"' }
				})
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(await runTool(statTool, { path: 'docs/a.md' }))
			expect(result['exists']).toBe(true)
			const item = result['item']
			if (isPlainObject(item)) {
				expect(item['path']).toBe('docs/a.md')
				expect(item['kind']).toBe('file')
				expect(item['media_type']).toBe('text/markdown')
			}
		} finally {
			globalThis.fetch = original
		}
	})

	test('puts and deletes under root_prefix', async () => {
		const bound = withAuth(filesModule, {
			root_prefix: 'orgs/acme/files/',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const putTool = bound.tools.find((t) => t.id === 'files-put')
		const deleteTool = bound.tools.find((t) => t.id === 'files-delete')
		if (!putTool || !deleteTool) throw new Error('missing tools')

		const original = globalThis.fetch
		const seen: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			seen.push(`${method} ${decodeURIComponent(url)}`)
			if (method === 'PUT' && decodeURIComponent(url).includes('orgs/acme/files/notes/a.txt')) {
				return new Response(null, { status: 200, headers: { etag: '"e1"' } })
			}
			if (method === 'DELETE' && decodeURIComponent(url).includes('orgs/acme/files/notes/a.txt')) {
				return new Response(null, { status: 204 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const put = asRecord(
				await runTool(putTool, {
					path: 'notes/a.txt',
					body: 'hello',
					body_encoding: 'utf8',
					content_type: 'text/plain'
				})
			)
			expect(put['path']).toBe('notes/a.txt')
			expect(put['content_length']).toBe(5)

			const del = asRecord(await runTool(deleteTool, { path: 'notes/a.txt' }))
			expect(del['deleted']).toBe(true)
			expect(seen.some((s) => s.includes('orgs/acme/files/notes/a.txt'))).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('moves under root_prefix via copy then delete', async () => {
		const bound = withAuth(filesModule, {
			root_prefix: 'orgs/acme/files/',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const moveTool = bound.tools.find((t) => t.id === 'files-move')
		if (!moveTool) throw new Error('missing move tool')

		const original = globalThis.fetch
		const seen: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			const decoded = decodeURIComponent(url)
			seen.push(`${method} ${decoded}`)
			// Copy is PUT destination with x-amz-copy-source (header shape varies after aws4fetch sign)
			if (method === 'PUT' && decoded.includes('orgs/acme/files/docs/b.md')) {
				return new Response('<CopyObjectResult><ETag>"moved"</ETag></CopyObjectResult>', {
					status: 200,
					headers: { 'content-type': 'application/xml' }
				})
			}
			if (method === 'DELETE' && decoded.includes('orgs/acme/files/docs/a.md')) {
				return new Response(null, { status: 204 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(moveTool, {
					source_path: 'docs/a.md',
					destination_path: 'docs/b.md'
				})
			)
			expect(result['source_path']).toBe('docs/a.md')
			expect(result['destination_path']).toBe('docs/b.md')
			expect(result['etag']).toBe('moved')
			expect(seen.some((s) => s.startsWith('PUT ') && s.includes('docs/b.md'))).toBe(true)
			expect(seen.some((s) => s.startsWith('DELETE ') && s.includes('docs/a.md'))).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('multipart start/upload-part/complete under root_prefix', async () => {
		const bound = withAuth(filesModule, {
			root_prefix: 'orgs/acme/files/',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const startTool = bound.tools.find((t) => t.id === 'files-multipart-start')
		const partTool = bound.tools.find((t) => t.id === 'files-multipart-upload-part')
		const completeTool = bound.tools.find((t) => t.id === 'files-multipart-complete')
		if (!startTool || !partTool || !completeTool) throw new Error('missing multipart tools')

		const original = globalThis.fetch
		const seen: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			const decoded = decodeURIComponent(url)
			seen.push(`${method} ${decoded}`)
			if (method === 'POST' && decoded.includes('uploads') && decoded.includes('orgs/acme/files/big.bin')) {
				return new Response(
					'<?xml version="1.0"?><InitiateMultipartUploadResult><UploadId>up-1</UploadId></InitiateMultipartUploadResult>',
					{ status: 200, headers: { 'content-type': 'application/xml' } }
				)
			}
			if (
				method === 'PUT' &&
				decoded.includes('orgs/acme/files/big.bin') &&
				decoded.includes('partNumber=1') &&
				decoded.includes('uploadId=up-1')
			) {
				return new Response(null, { status: 200, headers: { etag: '"part-etag-1"' } })
			}
			if (
				method === 'POST' &&
				decoded.includes('orgs/acme/files/big.bin') &&
				decoded.includes('uploadId=up-1') &&
				!decoded.includes('uploads')
			) {
				return new Response(
					'<?xml version="1.0"?><CompleteMultipartUploadResult><ETag>"final"</ETag></CompleteMultipartUploadResult>',
					{ status: 200, headers: { 'content-type': 'application/xml' } }
				)
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const started = asRecord(await runTool(startTool, { path: 'big.bin', content_type: 'application/octet-stream' }))
			expect(started['path']).toBe('big.bin')
			expect(started['upload_id']).toBe('up-1')

			const part = asRecord(
				await runTool(partTool, {
					path: 'big.bin',
					upload_id: 'up-1',
					part_number: 1,
					body: 'chunk-one',
					body_encoding: 'utf8'
				})
			)
			expect(part['etag']).toBe('part-etag-1')
			expect(part['content_length']).toBe(9)

			const completed = asRecord(
				await runTool(completeTool, {
					path: 'big.bin',
					upload_id: 'up-1',
					parts: [{ part_number: 1, etag: 'part-etag-1' }]
				})
			)
			expect(completed['etag']).toBe('final')
			expect(seen.every((s) => s.includes('orgs/acme/files/big.bin'))).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})
})
