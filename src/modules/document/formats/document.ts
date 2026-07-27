/** DOCX read, build, and edit implementation for the document capability. */
import {
	appendHeading,
	appendParagraph,
	createDocx,
	getTableCellText,
	openDocx,
	replaceTextEverywhere,
	tables,
	text,
	toUint8Array
} from '@office-kit/docx'
import mammoth from 'mammoth'

import { toArrayBuffer } from '../../../shared/bytes'
import type { DocumentReadOutput, DocumentSection, DocumentTextReplacement } from '../contracts'
import { assertReplacementApplied } from './text'

function bufferFrom(bytes: Uint8Array): Buffer {
	return Buffer.from(toArrayBuffer(bytes))
}

export async function readDocument(bytes: Uint8Array): Promise<Pick<DocumentReadOutput, 'text' | 'html' | 'tables'>> {
	const document = openDocx(bytes)
	const converted = await mammoth.convertToHtml({ buffer: bufferFrom(bytes) })
	const documentTables = tables(document).map((table, index) => ({
		name: `Table ${index + 1}`,
		rows: table.rows.map((row, rowIndex) =>
			row.cells.map((_, columnIndex) => getTableCellText(table, rowIndex, columnIndex))
		)
	}))
	return {
		text: text(document),
		...(converted.value && { html: converted.value }),
		...(documentTables.length > 0 && { tables: documentTables })
	}
}

export async function buildDocument(input: {
	title?: string | undefined
	sections: DocumentSection[]
}): Promise<Uint8Array> {
	const document = createDocx()
	if (input.title) appendHeading(document, input.title, 1)
	for (const section of input.sections) {
		if (section.heading) appendHeading(document, section.heading, 1)
		for (const paragraph of section.paragraphs ?? []) appendParagraph(document, paragraph)
	}
	return toUint8Array(document)
}

export async function patchDocx(bytes: Uint8Array, replacements: DocumentTextReplacement[]): Promise<Uint8Array> {
	const document = openDocx(bytes)
	for (const replacement of replacements) {
		let applied = 0
		replaceTextEverywhere(document, replacement.find, () => {
			if (replacement.match === 'first' && applied > 0) return replacement.find
			applied += 1
			return replacement.replace
		})
		assertReplacementApplied(applied, replacement.find)
	}
	return toUint8Array(document)
}
