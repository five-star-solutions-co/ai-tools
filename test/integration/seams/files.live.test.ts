import { describe, expect, test } from 'bun:test'

import { FilesClient } from '../../../src/modules/files'
import { S3Client } from '../../../src/vendors/s3'
import { uniqueId } from '../env'
import { s3AuthFromEnv } from '../helpers'

const s3 = s3AuthFromEnv()
const run = describe

run('live seam files', () => {
	test(
		'list search stat put get delete copy mkdir move multipart',
		async () => {
			const root = 'ai-tools-files-it'
			const client = FilesClient.fromAuth({
				storage: { ...s3 },
				root_prefix: root
			})
			const path = `${uniqueId('f')}.txt`
			const copyPath = `${uniqueId('c')}.txt`
			const movePath = `${uniqueId('m')}.txt`
			const dir = uniqueId('d')

			await client.put({
				path,
				body: 'files seam',
				body_encoding: 'utf8',
				content_type: 'text/plain'
			})
			const listed = await client.list({ path: '', limit: 50 })
			expect(Array.isArray(listed.items)).toBe(true)

			const searched = await client.search({ path: '', query: path.slice(0, 8) })
			expect(searched).toBeDefined()

			const st = await client.stat({ path })
			expect(st).toBeDefined()

			const got = await client.get({ path })
			expect(got.body).toBeTruthy()

			await client.copy({ source_path: path, destination_path: copyPath })
			await client.mkdir({ path: dir })
			await client.move({ source_path: copyPath, destination_path: movePath })

			const mp = await client.multipartStart({
				path: `${uniqueId('mp')}.bin`,
				content_type: 'application/octet-stream'
			})
			const part = Buffer.alloc(5 * 1024 * 1024, 3)
			const uploaded = await client.multipartUploadPart({
				path: mp.path,
				upload_id: mp.upload_id,
				part_number: 1,
				body: part.toString('base64'),
				body_encoding: 'base64'
			})
			await client.multipartComplete({
				path: mp.path,
				upload_id: mp.upload_id,
				parts: [{ part_number: 1, etag: uploaded.etag }]
			})
			await client.delete({ path: mp.path })

			const abortPath = `${uniqueId('mpa')}.bin`
			const started = await client.multipartStart({ path: abortPath })
			await client.multipartAbort({ path: abortPath, upload_id: started.upload_id })

			await client.delete({ path })
			await client.delete({ path: movePath }).catch(() => undefined)
		},
		{ timeout: 60_000 }
	)

	test(
		'storage.key_prefix + root_prefix stack on the wire',
		async () => {
			const keyPrefix = `ai-tools-files-pfx/${uniqueId('org')}/`
			const rootPrefix = 'workspace/'
			const files = FilesClient.fromAuth({
				root_prefix: rootPrefix,
				storage: { ...s3, key_prefix: keyPrefix }
			})
			const unscoped = new S3Client(s3)
			const path = `notes/${uniqueId('n')}.txt`
			const wire = `${keyPrefix}${rootPrefix}${path}`

			await files.put({
				path,
				body: 'stacked prefixes',
				body_encoding: 'utf8',
				content_type: 'text/plain'
			})
			const got = await files.get({ path, encoding: 'utf8' })
			expect(got.path).toBe(path)
			expect(got.body).toBe('stacked prefixes')

			const listed = await files.list({ path: 'notes', limit: 50 })
			expect(listed.items.some((item) => item.path === path && item.kind === 'file')).toBe(true)

			const headWire = await unscoped.head({ key: wire })
			expect(headWire.exists).toBe(true)

			await files.delete({ path })
			expect((await unscoped.head({ key: wire })).exists).toBe(false)
		},
		{ timeout: 60_000 }
	)
})
