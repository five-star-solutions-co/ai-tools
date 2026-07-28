/**
 * Textract payload helpers + extract presentation (no HTTP).
 * inline | artifact | chunks — product logic lives in the vendor, not the seam.
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import type { ArtifactRef } from '../../shared/artifact'
import { DEFAULT_EXTRACT_CHUNK_MAX_CHARS, DEFAULT_EXTRACT_CHUNK_OVERLAP, MAX_INLINE_EXTRACT_CHARS } from './contracts'
import type { TextractExtractResult, TextractOutputMode, TextractTextChunk } from './contracts'

export function lineTextFromBlocks(payload: Record<string, unknown>): {
	text: string
	page_count?: number
} {
	const blocks = payload['Blocks']
	const lines: string[] = []
	if (isArray(blocks)) {
		for (const block of blocks) {
			if (!isPlainObject(block)) continue
			if (block['BlockType'] !== 'LINE') continue
			const t = block['Text']
			if (isString(t) && t.length > 0) lines.push(t)
		}
	}
	const meta = payload['DocumentMetadata']
	let page_count: number | undefined
	if (isPlainObject(meta) && typeof meta['Pages'] === 'number' && Number.isFinite(meta['Pages'])) {
		page_count = meta['Pages']
	}
	return {
		text: lines.join('\n'),
		...(page_count !== undefined && { page_count })
	}
}

export function mapJobStatus(jobStatus: string): 'succeeded' | 'pending' | 'failed' {
	if (jobStatus === 'SUCCEEDED' || jobStatus === 'PARTIAL_SUCCESS') return 'succeeded'
	if (jobStatus === 'FAILED') return 'failed'
	return 'pending'
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

export type PresentOptions = {
	output?: TextractOutputMode
	destination_key?: string
	chunk?: { max_chars?: number; overlap?: number }
	/** Source key hint for default artifact destination. */
	source_key?: string
}

/**
 * Apply output mode to a raw extract result.
 * - inline: fail with too_large when text exceeds MAX_INLINE_EXTRACT_CHARS
 * - artifact: caller must pass writeArtifact; text is stripped from the result
 * - chunks: split text for RAG handoff; full text stripped
 */
export async function presentExtractResult(
	raw: TextractExtractResult,
	options: PresentOptions,
	writeArtifact?: (key: string, text: string) => Promise<ArtifactRef>
): Promise<TextractExtractResult> {
	const mode: TextractOutputMode = options.output ?? 'inline'

	if (raw.status !== 'succeeded' || raw.text === undefined) {
		return baseResult(raw, mode)
	}

	const text = raw.text

	if (mode === 'inline') {
		if (text.length > MAX_INLINE_EXTRACT_CHARS) {
			throw new ToolError(
				`Extracted text exceeds inline limit (${MAX_INLINE_EXTRACT_CHARS} characters); use output: "artifact" or "chunks"`,
				{
					code: 'too_large',
					details: {
						max_inline_chars: MAX_INLINE_EXTRACT_CHARS,
						char_count: text.length,
						suggested_output: 'artifact'
					}
				}
			)
		}
		return baseResult(raw, 'inline')
	}

	if (mode === 'chunks') {
		const maxChars = options.chunk?.max_chars ?? DEFAULT_EXTRACT_CHUNK_MAX_CHARS
		const overlap = options.chunk?.overlap ?? DEFAULT_EXTRACT_CHUNK_OVERLAP
		const pieces = chunkText(text, { max_chars: maxChars, overlap })
		const docId = options.source_key ?? raw.job_id ?? 'extract'
		const chunks: TextractTextChunk[] = pieces.map((piece, index) => ({
			id: chunkId(docId, index),
			index,
			text: piece
		}))
		const out = baseResult(raw, 'chunks')
		delete out.text
		out.chunks = chunks
		return out
	}

	// artifact
	if (!writeArtifact) {
		throw new ToolError('Artifact output requires object storage credentials on extract auth', {
			code: 'bad_auth'
		})
	}
	const key =
		options.destination_key ?? `extracts/${raw.job_id ?? sanitizeKeySegment(options.source_key ?? 'document')}.txt`
	const artifact = await writeArtifact(key, text)
	const out = baseResult(raw, 'artifact')
	delete out.text
	out.artifact = artifact
	return out
}

function baseResult(raw: TextractExtractResult, mode: TextractOutputMode): TextractExtractResult {
	const out: TextractExtractResult = {
		status: raw.status,
		output: mode
	}
	if (raw.job_id !== undefined) out.job_id = raw.job_id
	if (raw.text !== undefined) out.text = raw.text
	if (raw.page_count !== undefined) out.page_count = raw.page_count
	if (raw.error !== undefined) out.error = raw.error
	if (raw.source !== undefined) out.source = raw.source
	return out
}

function sanitizeKeySegment(value: string): string {
	const base = value.replace(/^.*\//, '').replace(/[^\w.-]+/g, '_')
	return base.length > 0 ? base.slice(0, 120) : 'document'
}

function chunkId(documentId: string, index: number): string {
	return `${documentId}#${index}`
}

/** Overlapping character windows; prefers paragraph/newline soft breaks. */
function chunkText(text: string, options: { max_chars: number; overlap: number }): string[] {
	const maxChars = options.max_chars
	const overlap = Math.min(options.overlap, Math.max(0, maxChars - 1))
	const normalized = text.replace(/\r\n/g, '\n').trim()
	if (normalized.length === 0) return []
	if (normalized.length <= maxChars) return [normalized]

	const chunks: string[] = []
	let start = 0
	while (start < normalized.length) {
		let end = Math.min(start + maxChars, normalized.length)
		if (end < normalized.length) {
			const window = normalized.slice(start, end)
			const para = window.lastIndexOf('\n\n')
			const line = window.lastIndexOf('\n')
			const soft = para >= maxChars * 0.5 ? para : line >= maxChars * 0.5 ? line : -1
			if (soft > 0) {
				end = start + soft
			}
		}
		const piece = normalized.slice(start, end).trim()
		if (piece.length > 0) chunks.push(piece)
		if (end >= normalized.length) break
		const next = end - overlap
		start = next <= start ? end : next
	}
	return chunks
}
