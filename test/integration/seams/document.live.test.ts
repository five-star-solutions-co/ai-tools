import { describe, expect, test } from 'bun:test'
import { PDFDocument } from 'pdf-lib'

import { DocumentClient } from '../../../src/modules/document'
import { S3Client } from '../../../src/vendors/s3'
import { objectKey, s3AuthFromEnv } from '../helpers'

const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = storage ? describe : describe.skip

async function cleanup(keys: string[]) {
	const s3 = new S3Client(storage!)
	for (const key of keys) await s3.delete({ key }).catch(() => undefined)
}

run('live seam document', () => {
	test('buildText read editText round-trip', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const outKey = objectKey('document-build')
		const editKey = objectKey('document-edit')
		const keys = [outKey, editKey]

		try {
			const built = await client.buildText({
				format: 'md',
				content: '# Hello\n\nIntegration document body.',
				output_key: outKey,
				filename: 'it.md'
			})
			expect(built.result.key).toBe(outKey)

			const read = await client.read({
				source: { artifact: { store: 'object', key: outKey, filename: 'it.md' } }
			})
			expect(read.text).toContain('Hello')

			const edited = await client.editText({
				source: { artifact: { store: 'object', key: outKey, filename: 'it.md' } },
				format: 'md',
				replacements: [{ find: 'Hello', replace: 'Updated', match: 'all' }],
				output_key: editKey,
				filename: 'it-edited.md'
			})
			expect(edited.result.key).toBe(editKey)

			const readEdited = await client.read({
				source: { artifact: { store: 'object', key: editKey, filename: 'it-edited.md' } }
			})
			expect(readEdited.text).toContain('Updated')
			expect(readEdited.text).not.toContain('Hello')
		} finally {
			await cleanup(keys)
		}
	})

	test('buildSpreadsheet editSpreadsheet read tables', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const key = objectKey('document-xlsx')
		const editKey = objectKey('document-xlsx-edit')
		const keys = [key, editKey]

		try {
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
				source: { artifact: { store: 'object', key, filename: 'it.xlsx' } }
			})
			expect(read.tables?.[0]?.rows?.[0]).toEqual(['a', 'b'])

			const edited = await client.editSpreadsheet({
				source: { artifact: { store: 'object', key, filename: 'it.xlsx' } },
				patches: [{ row: 2, col: 2, value: 99 }],
				output_key: editKey,
				filename: 'it-edited.xlsx'
			})
			expect(edited.result.key).toBe(editKey)

			const readEdited = await client.read({
				source: { artifact: { store: 'object', key: editKey, filename: 'it-edited.xlsx' } }
			})
			expect(readEdited.tables?.[0]?.rows?.[1]?.[1]).toBe(99)
		} finally {
			await cleanup(keys)
		}
	})

	test('buildDocument editDocument read', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const key = objectKey('document-docx')
		const editKey = objectKey('document-docx-edit')
		const keys = [key, editKey]

		try {
			const built = await client.buildDocument({
				title: 'IT Title',
				sections: [{ heading: 'Section', paragraphs: ['Hello document'] }],
				output_key: key,
				filename: 'it.docx'
			})
			expect(built.result.key).toBe(key)

			const read = await client.read({
				source: { artifact: { store: 'object', key, filename: 'it.docx' } }
			})
			expect(read.text).toContain('Hello document')

			const edited = await client.editDocument({
				source: { artifact: { store: 'object', key, filename: 'it.docx' } },
				replacements: [{ find: 'Hello', replace: 'Updated', match: 'all' }],
				output_key: editKey,
				filename: 'it-edited.docx'
			})
			expect(edited.result.key).toBe(editKey)

			const readEdited = await client.read({
				source: { artifact: { store: 'object', key: editKey, filename: 'it-edited.docx' } }
			})
			expect(readEdited.text).toContain('Updated document')
		} finally {
			await cleanup(keys)
		}
	})

	test('buildPresentation editPresentation read slides', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const key = objectKey('document-pptx')
		const editKey = objectKey('document-pptx-edit')
		const keys = [key, editKey]

		try {
			const built = await client.buildPresentation({
				title: 'Deck',
				slides: [{ title: 'Hello slide', bullets: ['one', 'two'], notes: 'Speaker notes' }],
				output_key: key,
				filename: 'it.pptx'
			})
			expect(built.result.key).toBe(key)

			const read = await client.read({
				source: { artifact: { store: 'object', key, filename: 'it.pptx' } }
			})
			expect(read.slides?.[0]?.title).toContain('Hello')
			expect(read.slides?.[0]?.notes).toContain('Speaker')

			const edited = await client.editPresentation({
				source: { artifact: { store: 'object', key, filename: 'it.pptx' } },
				replacements: [{ find: 'Hello', replace: 'Updated' }],
				output_key: editKey,
				filename: 'it-edited.pptx'
			})
			expect(edited.result.key).toBe(editKey)

			const readEdited = await client.read({
				source: { artifact: { store: 'object', key: editKey, filename: 'it-edited.pptx' } }
			})
			expect(readEdited.slides?.[0]?.title).toContain('Updated')
		} finally {
			await cleanup(keys)
		}
	})

	test('read PDF page text from object storage', async () => {
		const client = DocumentClient.fromAuth({ storage: storage! })
		const key = objectKey('document-pdf')
		const s3 = new S3Client(storage!)
		const pdf = await PDFDocument.create()
		pdf.addPage([200, 200])
		await s3.putBytes(key, await pdf.save(), 'application/pdf')

		try {
			const read = await client.read({
				source: { artifact: { store: 'object', key, filename: 'it.pdf' } }
			})
			expect(read.page_count).toBe(1)
			expect(read.format).toBe('pdf')
		} finally {
			await s3.delete({ key }).catch(() => undefined)
		}
	})
})
