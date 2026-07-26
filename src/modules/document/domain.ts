/**
 * Document read/build pure helpers (no HTTP).
 */

import { isString } from 'es-toolkit'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import PptxGenJS from 'pptxgenjs'
import { extractText } from 'unpdf'

import { ToolError } from '../../core/errors'
import { bytesToUtf8, utf8ToBytes } from '../../shared/bytes'
import { mediaTypeFromPath, resolveFileExtension } from '../../shared/content-type'
import type { DocumentFormat, DocumentReadOutput, DocumentSection, DocumentSlide, DocumentTable } from './contracts'

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(copy).set(bytes)
	return copy
}

/**
 * Resolve document format. MIME/extension lookup is owned by
 * `shared/content-type` (mime-db); this only maps known extensions → DocumentFormat.
 */
export function detectFormat(input: {
	format?: DocumentFormat | undefined
	filename?: string | undefined
	media_type?: string | undefined
}): DocumentFormat {
	if (input.format) return input.format

	const ext = resolveFileExtension({
		filename: input.filename,
		mediaType: input.media_type,
		fallback: ''
	}).toLowerCase()

	const fromExt = formatFromExtension(ext)
	if (fromExt) return fromExt

	// Domain policy: any image/* is format `image` (mime may not map every subtype).
	const mt = (input.media_type ?? '').toLowerCase().split(';')[0]?.trim()
	if (mt?.startsWith('image/')) return 'image'

	throw new ToolError('Could not detect document format; pass format or filename', { code: 'bad_input' })
}

function formatFromExtension(ext: string): DocumentFormat | undefined {
	switch (ext) {
		case 'pdf':
			return 'pdf'
		case 'docx':
		case 'doc':
			return 'docx'
		case 'pptx':
		case 'ppt':
			return 'pptx'
		case 'xlsx':
		case 'xls':
			return 'xlsx'
		case 'csv':
			return 'csv'
		case 'html':
		case 'htm':
			return 'html'
		case 'md':
		case 'markdown':
			return 'md'
		case 'json':
			return 'json'
		case 'txt':
		case 'text':
			return 'txt'
		case 'png':
		case 'jpg':
		case 'jpeg':
		case 'webp':
		case 'gif':
		case 'bmp':
		case 'tiff':
		case 'tif':
			return 'image'
		default:
			return undefined
	}
}

export async function readBytes(
	format: DocumentFormat,
	bytes: Uint8Array,
	meta: { filename?: string | undefined; media_type?: string | undefined }
): Promise<DocumentReadOutput> {
	const base: DocumentReadOutput = {
		format,
		byte_length: bytes.byteLength
	}
	if (meta.filename !== undefined) base.filename = meta.filename
	if (meta.media_type !== undefined) base.media_type = meta.media_type

	switch (format) {
		case 'txt':
		case 'md':
		case 'html':
			return { ...base, text: bytesToUtf8(bytes) }
		case 'json': {
			const text = bytesToUtf8(bytes)
			try {
				JSON.parse(text)
			} catch (error) {
				throw new ToolError('Invalid JSON document', { code: 'bad_input', cause: error })
			}
			return { ...base, text }
		}
		case 'csv':
			return { ...base, text: bytesToUtf8(bytes), tables: [parseCsvTable(bytesToUtf8(bytes))] }
		case 'xlsx':
			return { ...base, ...(await readXlsx(bytes)) }
		case 'docx':
			return { ...base, ...(await readDocx(bytes)) }
		case 'pptx':
			return { ...base, ...(await readPptx(bytes)) }
		case 'pdf':
			return { ...base, text: await readPdfText(bytes) }
		case 'image':
			return base
		default:
			throw new ToolError('Unsupported format for read', { code: 'unsupported' })
	}
}

function parseCsvTable(text: string): DocumentTable {
	const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
	const rows = lines.map((line) => splitCsvLine(line))
	return { name: 'Sheet1', rows }
}

function splitCsvLine(line: string): string[] {
	const cells: string[] = []
	let cur = ''
	let inQuotes = false
	for (let i = 0; i < line.length; i += 1) {
		const ch = line[i]
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				cur += '"'
				i += 1
			} else {
				inQuotes = !inQuotes
			}
			continue
		}
		if (ch === ',' && !inQuotes) {
			cells.push(cur)
			cur = ''
			continue
		}
		cur += ch ?? ''
	}
	cells.push(cur)
	return cells
}

function cellToValue(v: unknown): string | number | boolean | null {
	if (v === null || v === undefined) return null
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
	if (typeof v === 'object' && v !== null) {
		if ('text' in v) {
			const t = Reflect.get(v, 'text')
			if (isString(t)) return t
		}
		if ('result' in v) {
			const r = Reflect.get(v, 'result')
			if (typeof r === 'string' || typeof r === 'number' || typeof r === 'boolean') return r
			if (r === null) return null
			if (isString(r) || typeof r === 'number' || typeof r === 'boolean') return r
		}
	}
	if (typeof v === 'bigint') return Number(v)
	return null
}

async function readXlsx(bytes: Uint8Array): Promise<Pick<DocumentReadOutput, 'text' | 'tables'>> {
	const workbook = new ExcelJS.Workbook()
	await workbook.xlsx.load(asArrayBuffer(bytes))
	const tables: DocumentTable[] = []
	const textParts: string[] = []
	workbook.eachSheet((sheet) => {
		const rows: DocumentTable['rows'] = []
		sheet.eachRow({ includeEmpty: false }, (row) => {
			const values = row.values
			const cells: Array<string | number | boolean | null> = []
			if (Array.isArray(values)) {
				for (let i = 1; i < values.length; i += 1) {
					cells.push(cellToValue(values[i]))
				}
			}
			rows.push(cells)
			textParts.push(cells.map((c) => (c === null ? '' : String(c))).join('\t'))
		})
		tables.push({ name: sheet.name, rows })
	})
	return { tables, text: textParts.join('\n') }
}

async function readDocx(bytes: Uint8Array): Promise<Pick<DocumentReadOutput, 'text' | 'html'>> {
	const buffer = Buffer.from(asArrayBuffer(bytes))
	const raw = await mammoth.extractRawText({ buffer })
	const html = await mammoth.convertToHtml({ buffer })
	const out: Pick<DocumentReadOutput, 'text' | 'html'> = { text: raw.value }
	if (html.value.length > 0) out.html = html.value
	return out
}

async function readPptx(bytes: Uint8Array): Promise<Pick<DocumentReadOutput, 'text' | 'slides'>> {
	const zip = await JSZip.loadAsync(bytes)
	const slideFiles = Object.keys(zip.files)
		.filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
		.sort((a, b) => {
			const na = Number(a.match(/slide(\d+)/i)?.[1] ?? 0)
			const nb = Number(b.match(/slide(\d+)/i)?.[1] ?? 0)
			return na - nb
		})
	const slides: DocumentSlide[] = []
	const textParts: string[] = []
	for (const name of slideFiles) {
		const file = zip.file(name)
		if (!file) continue
		const xml = await file.async('string')
		const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1] ?? '').filter((t) => t.length > 0)
		const title = texts[0]
		const bullets = texts.slice(1)
		const slide: DocumentSlide = {}
		if (title !== undefined) slide.title = title
		if (bullets.length > 0) slide.bullets = bullets
		slides.push(slide)
		textParts.push([title, ...bullets].filter((t): t is string => t !== undefined && t.length > 0).join('\n'))
	}
	return { slides, text: textParts.join('\n\n') }
}

async function readPdfText(bytes: Uint8Array): Promise<string> {
	try {
		const { text } = await extractText(bytes)
		if (Array.isArray(text)) return text.join('\n')
		if (isString(text)) return text
		return ''
	} catch (error) {
		throw new ToolError('Failed to extract text from PDF', { code: 'upstream', cause: error })
	}
}

export async function buildSpreadsheet(sheets: DocumentTable[]): Promise<Uint8Array> {
	const workbook = new ExcelJS.Workbook()
	for (const sheet of sheets) {
		const ws = workbook.addWorksheet(sheet.name ?? 'Sheet1')
		for (const row of sheet.rows) {
			ws.addRow(row.map((c) => (c === null ? '' : c)))
		}
	}
	const buf = await workbook.xlsx.writeBuffer()
	return new Uint8Array(buf)
}

export async function buildDocument(input: {
	title?: string | undefined
	sections: DocumentSection[]
}): Promise<Uint8Array> {
	const children: Paragraph[] = []
	if (input.title) {
		children.push(
			new Paragraph({
				text: input.title,
				heading: HeadingLevel.TITLE
			})
		)
	}
	for (const section of input.sections) {
		if (section.heading) {
			children.push(
				new Paragraph({
					text: section.heading,
					heading: HeadingLevel.HEADING_1
				})
			)
		}
		for (const p of section.paragraphs ?? []) {
			children.push(new Paragraph({ children: [new TextRun(p)] }))
		}
	}
	if (children.length === 0) {
		children.push(new Paragraph({ text: '' }))
	}
	const doc = new Document({ sections: [{ children }] })
	const buf = await Packer.toBuffer(doc)
	return new Uint8Array(buf)
}

export async function buildPresentation(input: {
	title?: string | undefined
	slides: DocumentSlide[]
}): Promise<Uint8Array> {
	const pptx = new PptxGenJS()
	if (input.title) pptx.title = input.title
	for (const slide of input.slides) {
		const s = pptx.addSlide()
		let y = 0.5
		if (slide.title) {
			s.addText(slide.title, { x: 0.5, y, w: 9, h: 0.8, fontSize: 28, bold: true })
			y += 1
		}
		if (slide.bullets && slide.bullets.length > 0) {
			s.addText(
				slide.bullets.map((b) => ({ text: b, options: { bullet: true } })),
				{ x: 0.5, y, w: 9, h: 4, fontSize: 16 }
			)
		}
		if (slide.notes) s.addNotes(slide.notes)
	}
	const out = await pptx.write({ outputType: 'arraybuffer' })
	if (out instanceof ArrayBuffer) return new Uint8Array(out)
	if (out instanceof Uint8Array) return out
	throw new ToolError('Presentation builder returned unexpected type', { code: 'internal' })
}

export async function patchSpreadsheet(
	bytes: Uint8Array,
	format: 'xlsx' | 'csv',
	patches: Array<{ sheet?: string | undefined; row: number; col: number; value: string | number | boolean | null }>
): Promise<{ bytes: Uint8Array; media_type: string; filename_ext: string }> {
	if (format === 'csv') {
		const table = parseCsvTable(bytesToUtf8(bytes))
		const rows = table.rows.map((r) => [...r])
		for (const p of patches) {
			const r = p.row - 1
			const c = p.col - 1
			while (rows.length <= r) rows.push([])
			const row = rows[r] ?? []
			while (row.length <= c) row.push(null)
			row[c] = p.value
			rows[r] = row
		}
		const csv = rows
			.map((row) =>
				row
					.map((cell) => {
						const s = cell === null ? '' : String(cell)
						return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replaceAll('"', '""')}"` : s
					})
					.join(',')
			)
			.join('\n')
		return { bytes: utf8ToBytes(csv), media_type: 'text/csv', filename_ext: 'csv' }
	}

	const workbook = new ExcelJS.Workbook()
	await workbook.xlsx.load(asArrayBuffer(bytes))
	for (const p of patches) {
		const sheet = p.sheet ? workbook.getWorksheet(p.sheet) : workbook.worksheets[0]
		if (!sheet) {
			throw new ToolError(`Sheet not found: ${p.sheet ?? '(first)'}`, { code: 'bad_input' })
		}
		sheet.getCell(p.row, p.col).value = p.value
	}
	const buf = await workbook.xlsx.writeBuffer()
	return {
		bytes: new Uint8Array(buf),
		media_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		filename_ext: 'xlsx'
	}
}

/** MIME for a text-ish document format — uses shared mime-db via content-type helpers. */
export function mediaTypeForTextFormat(format: 'txt' | 'md' | 'json' | 'csv' | 'html'): string {
	return mediaTypeFromPath(`file.${format}`) ?? 'application/octet-stream'
}
