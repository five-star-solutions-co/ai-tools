import { Readable } from 'node:stream'

import ExcelJS from 'exceljs'
import { isPlainObject } from 'es-toolkit'

import { ToolError } from '../../../core/errors'
import { toArrayBuffer } from '../../../shared/bytes'
import type { DocumentTable } from '../contracts'

type CellPatch = {
	sheet?: string | undefined
	row: number
	col: number
	value: string | number | boolean | null
}

function cellValue(value: unknown, displayText: string): string | number | boolean | null {
	if (value === null || value === undefined) return null
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
	if (value instanceof Date) return value.toISOString()
	if (isPlainObject(value)) {
		const result = value['result']
		if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') return result
	}
	return displayText
}

function worksheetTable(worksheet: ExcelJS.Worksheet): DocumentTable {
	const rows: DocumentTable['rows'] = []
	worksheet.eachRow({ includeEmpty: false }, (row) => {
		const values: DocumentTable['rows'][number] = []
		for (let column = 1; column <= row.cellCount; column += 1) {
			const cell = row.getCell(column)
			values.push(cellValue(cell.value, cell.text))
		}
		rows.push(values)
	})
	return { name: worksheet.name, rows }
}

function tablesFromWorkbook(workbook: ExcelJS.Workbook): DocumentTable[] {
	return workbook.worksheets.map(worksheetTable)
}

function textFromTables(tables: DocumentTable[]): string {
	return tables
		.flatMap((table) => table.rows.map((row) => row.map((cell) => (cell === null ? '' : String(cell))).join('\t')))
		.join('\n')
}

async function loadCsv(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
	const workbook = new ExcelJS.Workbook()
	await workbook.csv.read(Readable.from([Buffer.from(bytes)]))
	return workbook
}

async function loadXlsx(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
	const workbook = new ExcelJS.Workbook()
	await workbook.xlsx.load(toArrayBuffer(bytes))
	return workbook
}

export async function readSpreadsheet(
	format: 'csv' | 'xlsx',
	bytes: Uint8Array
): Promise<{ text: string; tables: DocumentTable[] }> {
	const workbook = format === 'csv' ? await loadCsv(bytes) : await loadXlsx(bytes)
	const tables = tablesFromWorkbook(workbook)
	return { tables, text: textFromTables(tables) }
}

export async function buildSpreadsheet(sheets: DocumentTable[]): Promise<Uint8Array> {
	const workbook = new ExcelJS.Workbook()
	for (const sheet of sheets) {
		const worksheet = workbook.addWorksheet(sheet.name ?? 'Sheet1')
		for (const row of sheet.rows) worksheet.addRow(row)
	}
	return new Uint8Array(await workbook.xlsx.writeBuffer())
}

export async function patchSpreadsheet(
	bytes: Uint8Array,
	format: 'csv' | 'xlsx',
	patches: CellPatch[]
): Promise<{ bytes: Uint8Array; filename_ext: 'csv' | 'xlsx'; media_type: string }> {
	const workbook = format === 'csv' ? await loadCsv(bytes) : await loadXlsx(bytes)
	for (const patch of patches) {
		const worksheet = patch.sheet ? workbook.getWorksheet(patch.sheet) : workbook.worksheets[0]
		if (!worksheet) {
			throw new ToolError('Spreadsheet sheet was not found', {
				code: 'bad_input',
				details: { sheet: patch.sheet ?? '(first)' }
			})
		}
		worksheet.getCell(patch.row, patch.col).value = patch.value
	}

	if (format === 'csv') {
		const worksheet = workbook.worksheets[0]
		if (!worksheet) throw new ToolError('CSV has no worksheet', { code: 'bad_input' })
		const output = await workbook.csv.writeBuffer({ sheetId: worksheet.id })
		return { bytes: new Uint8Array(output), filename_ext: 'csv', media_type: 'text/csv' }
	}

	return {
		bytes: new Uint8Array(await workbook.xlsx.writeBuffer()),
		filename_ext: 'xlsx',
		media_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	}
}
