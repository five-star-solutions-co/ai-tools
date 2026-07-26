import type { ParagraphOptions, SlideChild, TableCellOptions, TextBodyOptions } from '@office-open/pptx'
import { parsePresentation } from '@office-open/pptx/parse'
import Automizer, { modify } from 'pptx-automizer'
import PptxGenJS from 'pptxgenjs'

import { ToolError } from '../../../core/errors'
import type { DocumentPresentationReplacement, DocumentReadOutput, DocumentSlide, DocumentTable } from '../contracts'
import { assertReplacementApplied } from './text'

function paragraphText(paragraph: ParagraphOptions | string): string {
	if (typeof paragraph === 'string') return paragraph
	if (paragraph.text) return paragraph.text
	return (paragraph.children ?? []).map((child) => (typeof child === 'string' ? child : (child.text ?? ''))).join('')
}

function textBodyLines(body: TextBodyOptions | undefined): string[] {
	if (!body) return []
	if (body.text) return [body.text]
	return (body.children ?? []).map(paragraphText).filter(Boolean)
}

function cellText(cell: TableCellOptions): string {
	if (cell.text) return cell.text
	return (cell.children ?? []).map(paragraphText).join('\n')
}

function notesText(notes: string | undefined): string {
	return (notes ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join(' ')
}

function shapeText(child: SlideChild): { title: boolean; lines: string[] } | undefined {
	if (!('shape' in child)) return undefined
	const lines = textBodyLines(child.shape.textBody)
	if (lines.length === 0) return undefined
	return {
		title: child.shape.placeholder === 'title',
		lines
	}
}

function slideTables(children: SlideChild[], slideNumber: number): DocumentTable[] {
	return children.flatMap((child, index) => {
		if (!('table' in child)) return []
		return [
			{
				name: `Slide ${slideNumber} Table ${index + 1}`,
				rows: child.table.rows.map((row) => row.cells.map(cellText))
			}
		]
	})
}

export async function readPresentation(
	bytes: Uint8Array
): Promise<Pick<DocumentReadOutput, 'text' | 'slides' | 'tables'>> {
	const presentation = parsePresentation(bytes)
	const slides: DocumentSlide[] = []
	const tables: DocumentTable[] = []
	const text: string[] = []
	for (const [index, source] of (presentation.slides ?? []).entries()) {
		const children = source.children ?? []
		const shapes = children.map(shapeText).filter((shape) => shape !== undefined)
		const titleShape = shapes.find((shape) => shape.title) ?? shapes[0]
		const title = titleShape?.lines.join(' ').trim()
		const bullets = shapes.filter((shape) => shape !== titleShape).flatMap((shape) => shape.lines)
		const notes = notesText(source.notes)
		const slide: DocumentSlide = {
			...(title && { title }),
			...(bullets.length > 0 && { bullets }),
			...(notes && { notes })
		}
		slides.push(slide)
		tables.push(...slideTables(children, index + 1))
		text.push([title, ...bullets, notes].filter(Boolean).join('\n'))
	}
	return {
		slides,
		text: text.join('\n\n'),
		...(tables.length > 0 && { tables })
	}
}

export async function buildPresentation(input: {
	title?: string | undefined
	slides: DocumentSlide[]
}): Promise<Uint8Array> {
	const presentation = new PptxGenJS()
	if (input.title) presentation.title = input.title
	for (const slide of input.slides) {
		const page = presentation.addSlide()
		let y = 0.5
		if (slide.title) {
			page.addText(slide.title, { x: 0.5, y, w: 9, h: 0.8, fontSize: 28, bold: true })
			y += 1
		}
		if (slide.bullets?.length) {
			page.addText(
				slide.bullets.map((bullet) => ({ text: bullet, options: { bullet: true } })),
				{ x: 0.5, y, w: 9, h: 4, fontSize: 16 }
			)
		}
		if (slide.notes) page.addNotes(slide.notes)
	}
	const output = await presentation.write({ outputType: 'arraybuffer' })
	if (output instanceof ArrayBuffer || output instanceof Uint8Array) return new Uint8Array(output)
	throw new ToolError('Presentation builder returned unexpected type', { code: 'internal' })
}

export async function patchPptx(
	bytes: Uint8Array,
	replacements: DocumentPresentationReplacement[]
): Promise<Uint8Array> {
	const content = await readPresentation(bytes)
	const editableText = [
		...(content.slides ?? []).flatMap((slide) => [slide.title, ...(slide.bullets ?? [])]),
		...(content.tables ?? []).flatMap((table) => table.rows.flat())
	]
		.filter(Boolean)
		.join('\n')
	for (const replacement of replacements) {
		assertReplacementApplied(editableText.includes(replacement.find) ? 1 : 0, replacement.find)
	}
	const automation = new Automizer({
		autoImportSlideMasters: true,
		cleanup: true,
		removeExistingSlides: true,
		verbosity: 0
	})
	const presentation = automation.loadRoot(bytes).load(bytes, 'source')
	const slideNumbers = await presentation.getTemplate('source').getAllSlideNumbers()
	const changes = replacements.map((replacement) => ({
		replace: replacement.find,
		by: { text: replacement.replace }
	}))
	for (const slideNumber of slideNumbers) {
		presentation.addSlide('source', slideNumber, (slide) => {
			slide.modify((document) => {
				modify.replaceText(changes, { openingTag: '', closingTag: '' })(document.documentElement)
			})
		})
	}
	const archive = await presentation.getJSZip()
	return archive.generateAsync({ type: 'uint8array' })
}
