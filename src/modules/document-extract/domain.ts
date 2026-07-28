/**
 * Document-extract presentation helpers (no HTTP).
 * Maps raw extract results into inline / artifact / chunks output modes.
 */

import { ToolError } from '../../core/errors'
import type { ArtifactRef } from '../../shared/artifact'
import { chunkId, chunkText } from '../rag/domain'
import type { ExtractOutputMode, ExtractResult, ExtractTextChunk } from './contracts'
import { DEFAULT_EXTRACT_CHUNK_MAX_CHARS, DEFAULT_EXTRACT_CHUNK_OVERLAP, MAX_INLINE_EXTRACT_CHARS } from './contracts'

export type PresentOptions = {
	output?: ExtractOutputMode
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
	raw: ExtractResult,
	options: PresentOptions,
	writeArtifact?: (key: string, text: string) => Promise<ArtifactRef>
): Promise<ExtractResult> {
	const mode: ExtractOutputMode = options.output ?? 'inline'

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
		const chunks: ExtractTextChunk[] = pieces.map((piece, index) => ({
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

function baseResult(raw: ExtractResult, mode: ExtractOutputMode): ExtractResult {
	const out: ExtractResult = {
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
