/**
 * Amazon settlement report V2 (GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2).
 * TSV via papaparse; money via decimal.js. Never put raw row PII in errors/output.
 */

import Decimal from 'decimal.js'
import Papa from 'papaparse'

import { ToolError } from '../../../core/errors'
import type { AmazonSpApiSettlementSummary } from '../contracts'

/** Report type for Flat File V2 Settlement (auto-scheduled by Amazon). */
export const SETTLEMENT_REPORT_TYPE_V2 = 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2'

/** How far back listReports looks for completed settlement reports. */
export const SETTLEMENT_RETENTION_DAYS = 90

/** Max compressed document body (bytes). */
export const SETTLEMENT_MAX_COMPRESSED_BYTES = 16 * 1024 * 1024

/** Max decompressed TSV body (bytes). */
export const SETTLEMENT_MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024

/** Max data rows (excluding header). */
export const SETTLEMENT_MAX_ROWS = 250_000

/** Required V2 header names (order free after parse; extra trailing columns OK). */
export const SETTLEMENT_V2_REQUIRED_COLUMNS = [
	'settlement-id',
	'settlement-start-date',
	'settlement-end-date',
	'deposit-date',
	'total-amount',
	'currency',
	'amount'
] as const

type SettlementRow = Record<string, string | undefined>

function settlementError(
	message: string,
	code: 'bad_input' | 'upstream' | 'too_large' | 'not_found' | 'unsupported' = 'upstream'
): never {
	throw new ToolError(message, { code })
}

function cell(row: SettlementRow, key: string): string {
	return (row[key] ?? '').trim()
}

/**
 * Parse Amazon settlement amount strings to safe integer cents via decimal.js.
 * Empty → 0. Strips US thousands commas only (`1,234.56` → `1234.56`).
 */
export function parseUsMoneyToSafeCents(raw: string): number {
	const trimmed = raw.trim()
	if (trimmed.length === 0) return 0
	// Amazon V2 is US-style; drop thousands separators so Decimal accepts the value.
	const normalized = trimmed.replace(/,/g, '')
	let value: Decimal
	try {
		value = new Decimal(normalized)
	} catch {
		settlementError('Settlement report has an invalid amount cell', 'upstream')
	}
	if (!value.isFinite()) {
		settlementError('Settlement report has a non-numeric amount', 'upstream')
	}
	const cents = value.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
	if (!cents.isInteger()) {
		settlementError('Settlement report has a non-numeric amount', 'upstream')
	}
	const n = cents.toNumber()
	if (!Number.isSafeInteger(n)) {
		settlementError('Settlement amount exceeds safe integer cents range', 'upstream')
	}
	return n
}

/** Copy into a fresh ArrayBuffer so Blob accepts it under exact DOM typings. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength)
	copy.set(bytes)
	return copy.buffer
}

/** Decompress GZIP when report document uses compressionAlgorithm GZIP (Web DecompressionStream). */
export async function maybeGunzipReportBytes(
	bytes: Uint8Array,
	compressionAlgorithm: string | undefined
): Promise<Uint8Array> {
	if (!compressionAlgorithm) return bytes
	const algo = compressionAlgorithm.toUpperCase()
	if (algo !== 'GZIP') {
		settlementError(`Unsupported settlement report compression: ${algo}`, 'upstream')
	}
	if (bytes.byteLength > SETTLEMENT_MAX_COMPRESSED_BYTES) {
		settlementError('Settlement report compressed body exceeds limit', 'too_large')
	}
	if (typeof DecompressionStream === 'undefined') {
		settlementError('GZIP decompression is not available in this runtime', 'unsupported')
	}
	try {
		const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'))
		const buffer = await new Response(stream).arrayBuffer()
		if (buffer.byteLength > SETTLEMENT_MAX_DECOMPRESSED_BYTES) {
			settlementError('Settlement report decompressed body exceeds limit', 'too_large')
		}
		return new Uint8Array(buffer)
	} catch (error) {
		if (error instanceof ToolError) throw error
		settlementError('Failed to decompress settlement report', 'upstream')
	}
}

/**
 * Parse Flat File V2 settlement TSV into the eight summary fields only.
 * Validates single settlement-id, currency, period, and amount sum vs total-amount.
 */
export function parseSettlementV2Tsv(text: string): AmazonSpApiSettlementSummary {
	const result = Papa.parse<SettlementRow>(text, {
		delimiter: '\t',
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (header) => header.trim().replace(/^\uFEFF/, '')
	})

	if (result.errors.length > 0) {
		settlementError('Settlement report TSV could not be parsed', 'upstream')
	}

	const fields = result.meta.fields ?? []
	for (const required of SETTLEMENT_V2_REQUIRED_COLUMNS) {
		if (!fields.includes(required)) {
			settlementError('Settlement report header columns do not match Flat File V2 schema', 'upstream')
		}
	}

	const rows = result.data
	if (rows.length === 0) {
		settlementError('Settlement report is empty or missing data rows', 'upstream')
	}
	if (rows.length > SETTLEMENT_MAX_ROWS) {
		settlementError('Settlement report exceeds max row limit', 'too_large')
	}

	let settlementId: string | undefined
	let settlementStart: string | undefined
	let settlementEnd: string | undefined
	let depositDate: string | undefined
	let currency: string | undefined
	let totalAmountCents: number | undefined
	let amountSum = new Decimal(0)

	for (const row of rows) {
		const rowSettlementId = cell(row, 'settlement-id')
		const rowStart = cell(row, 'settlement-start-date')
		const rowEnd = cell(row, 'settlement-end-date')
		const rowDeposit = cell(row, 'deposit-date')
		const rowTotal = cell(row, 'total-amount')
		const rowCurrency = cell(row, 'currency')
		const rowAmount = cell(row, 'amount')

		if (rowSettlementId.length === 0) {
			settlementError('Settlement report row missing settlement-id', 'upstream')
		}

		const rowTotalCents = parseUsMoneyToSafeCents(rowTotal)
		const rowAmountCents = parseUsMoneyToSafeCents(rowAmount)

		if (settlementId === undefined) {
			settlementId = rowSettlementId
			settlementStart = rowStart
			settlementEnd = rowEnd
			depositDate = rowDeposit
			currency = rowCurrency
			totalAmountCents = rowTotalCents
		} else {
			if (rowSettlementId !== settlementId) {
				settlementError('Settlement report contains multiple settlement ids', 'upstream')
			}
			if (rowStart !== settlementStart || rowEnd !== settlementEnd) {
				settlementError('Settlement report has inconsistent settlement period', 'upstream')
			}
			if (rowCurrency !== currency) {
				settlementError('Settlement report has inconsistent currency', 'upstream')
			}
			if (rowTotalCents !== totalAmountCents) {
				settlementError('Settlement report has inconsistent total-amount', 'upstream')
			}
			if (rowDeposit.length > 0) {
				if (depositDate && depositDate.length > 0 && rowDeposit !== depositDate) {
					settlementError('Settlement report has inconsistent deposit-date', 'upstream')
				}
				if (!depositDate || depositDate.length === 0) depositDate = rowDeposit
			}
		}

		amountSum = amountSum.plus(rowAmountCents)
	}

	if (
		settlementId === undefined ||
		settlementStart === undefined ||
		settlementEnd === undefined ||
		currency === undefined ||
		totalAmountCents === undefined
	) {
		settlementError('Settlement report has no usable data rows', 'upstream')
	}

	if (!amountSum.isInteger() || !Number.isSafeInteger(amountSum.toNumber())) {
		settlementError('Settlement amount sum exceeds safe integer cents range', 'upstream')
	}
	const amountSumCents = amountSum.toNumber()
	if (amountSumCents !== totalAmountCents) {
		settlementError('Settlement amount sum does not match total-amount', 'upstream')
	}

	return {
		settlement_id: settlementId,
		settlement_start_date: settlementStart,
		settlement_end_date: settlementEnd,
		deposit_date: depositDate && depositDate.length > 0 ? depositDate : settlementEnd,
		currency,
		total_amount_cents: totalAmountCents,
		amount_sum_cents: amountSumCents,
		row_count: rows.length
	}
}

/** Decode UTF-8 document bytes (after optional gunzip) and parse summary. */
export async function summarizeSettlementDocument(
	bytes: Uint8Array,
	compressionAlgorithm: string | undefined
): Promise<AmazonSpApiSettlementSummary> {
	if (!compressionAlgorithm && bytes.byteLength > SETTLEMENT_MAX_DECOMPRESSED_BYTES) {
		settlementError('Settlement report body exceeds limit', 'too_large')
	}
	const plain = await maybeGunzipReportBytes(bytes, compressionAlgorithm)
	if (plain.byteLength > SETTLEMENT_MAX_DECOMPRESSED_BYTES) {
		settlementError('Settlement report body exceeds limit', 'too_large')
	}
	const text = new TextDecoder('utf-8', { fatal: false }).decode(plain)
	return parseSettlementV2Tsv(text)
}

/** ISO createdSince for listReports retention window. */
export function settlementCreatedSinceIso(now = new Date(), retentionDays = SETTLEMENT_RETENTION_DAYS): string {
	const ms = retentionDays * 24 * 60 * 60 * 1000
	return new Date(now.getTime() - ms).toISOString()
}
