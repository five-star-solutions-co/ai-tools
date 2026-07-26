import { describe, expect, test } from 'bun:test'

import { DocumentClient } from '../../../src/modules/document'
import { S3Client } from '../../../src/vendors/s3'
import { objectKey, s3AuthFromEnv } from '../helpers'

const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = storage ? describe : describe.skip

run('live seam document', () => {
	test('buildText read editText round-trip on object storage', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const outKey = objectKey('document-build')
		const editKey = objectKey('document-edit')

		const built = await client.buildText({
			format: 'md',
			content: '# Hello\n\nIntegration document body.',
			output_key: outKey,
			filename: 'it.md'
		})
		expect(built.result.key).toBe(outKey)

		const read = await client.read({
			source: {
				artifact: { store: 'object', key: outKey, filename: 'it.md' }
			}
		})
		expect(read.text).toContain('Hello')
		expect(read.text).toContain('Integration document body')

		const edited = await client.editText({
			source: {
				artifact: { store: 'object', key: outKey, filename: 'it.md' }
			},
			format: 'md',
			replacements: [{ find: 'Hello', replace: 'Updated', match: 'all' }],
			output_key: editKey,
			filename: 'it-edited.md'
		})
		expect(edited.result.key).toBe(editKey)

		const readEdited = await client.read({
			source: {
				artifact: { store: 'object', key: editKey, filename: 'it-edited.md' }
			}
		})
		expect(readEdited.text).toContain('Updated')
		expect(readEdited.text).not.toContain('Hello')

		// Cleanup via raw S3 (document seam has no delete tool).
		const s3 = new S3Client(storage!)
		await s3.delete({ key: outKey })
		await s3.delete({ key: editKey })
	})

	test('buildSpreadsheet and read tables', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const key = objectKey('document-xlsx')
		const built = await client.buildSpreadsheet({
			output_key: key,
			filename: 'it.xlsx',
			sheets: [
				{
					name: 'Sheet1',
					rows: [
						['a', 'b'],
						[1, 2]
					]
				}
			]
		})
		expect(built.result.key).toBe(key)

		const read = await client.read({
			source: {
				artifact: { store: 'object', key, filename: 'it.xlsx' }
			}
		})
		expect(read.tables?.[0]?.rows?.[0]).toEqual(['a', 'b'])

		await new S3Client(storage!).delete({ key })
	})
})
