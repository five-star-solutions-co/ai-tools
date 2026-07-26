import { compile } from 'html-to-text'

import { ToolError } from '../../../core/errors'
import { bytesToUtf8, utf8ToBytes } from '../../../shared/bytes'
import { mediaTypeFromPath } from '../../../shared/content-type'
import type { DocumentFormat, DocumentTextReplacement } from '../contracts'

const convertHtml = compile({
	decodeEntities: true,
	preserveNewlines: false,
	wordwrap: false,
	selectors: [
		{ selector: 'script', format: 'skip' },
		{ selector: 'style', format: 'skip' },
		{ selector: 'h1', options: { uppercase: false } },
		{ selector: 'h2', options: { uppercase: false } },
		{ selector: 'h3', options: { uppercase: false } },
		{ selector: 'h4', options: { uppercase: false } },
		{ selector: 'h5', options: { uppercase: false } },
		{ selector: 'h6', options: { uppercase: false } }
	]
})

export function readHtml(html: string): { html: string; text: string } {
	return { html, text: convertHtml(html).trim() }
}

export function readJson(bytes: Uint8Array): string {
	const text = bytesToUtf8(bytes)
	try {
		JSON.parse(text)
		return text
	} catch (error) {
		throw new ToolError('Invalid JSON document', { code: 'bad_input', cause: error })
	}
}

export function replaceText(text: string, replacement: DocumentTextReplacement): { text: string; count: number } {
	if (replacement.match === 'first') {
		const index = text.indexOf(replacement.find)
		if (index < 0) return { text, count: 0 }
		return {
			text: `${text.slice(0, index)}${replacement.replace}${text.slice(index + replacement.find.length)}`,
			count: 1
		}
	}

	let count = 0
	let cursor = 0
	let output = ''
	while (true) {
		const index = text.indexOf(replacement.find, cursor)
		if (index < 0) break
		output += text.slice(cursor, index)
		output += replacement.replace
		cursor = index + replacement.find.length
		count += 1
	}
	if (count === 0) return { text, count: 0 }
	return { text: `${output}${text.slice(cursor)}`, count }
}

export function assertReplacementApplied(count: number, find: string): void {
	if (count > 0) return
	throw new ToolError('A requested text replacement did not match the source document', {
		code: 'bad_input',
		details: { find }
	})
}

export function patchTextDocument(
	bytes: Uint8Array,
	format: 'txt' | 'md' | 'json' | 'html',
	replacements: DocumentTextReplacement[]
): Uint8Array {
	let text = bytesToUtf8(bytes)
	for (const replacement of replacements) {
		const result = replaceText(text, replacement)
		assertReplacementApplied(result.count, replacement.find)
		text = result.text
	}
	if (format === 'json') {
		try {
			JSON.parse(text)
		} catch (error) {
			throw new ToolError('Text replacements produced invalid JSON', { code: 'bad_input', cause: error })
		}
	}
	return utf8ToBytes(text)
}

export function mediaTypeForTextFormat(
	format: Extract<DocumentFormat, 'txt' | 'md' | 'json' | 'csv' | 'html'>
): string {
	return mediaTypeFromPath(`document.${format}`) ?? 'text/plain'
}
