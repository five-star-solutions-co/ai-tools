import type { z } from 'zod'

import { ToolError } from '../../core/errors'
import type { ToolErrorCode } from '../../core/errors'
import { encodeObjectKeyPath, utf8ToBytes } from '../../shared/bytes'
import type { HttpQueryValue } from '../../transport/http-service'
import { SPS_RENDER_MAX_BYTES } from './contracts'
import type { SpsJsonObject } from './contracts'

/** Do not copy input values, validation messages, URLs, or provider bodies into errors. */
export function parseSps<T>(schema: z.ZodType<T>, value: unknown, code: ToolErrorCode = 'bad_input'): T {
	const result = schema.safeParse(value)
	if (!result.success) {
		throw new ToolError(code === 'upstream' ? 'Invalid SPS response' : 'Invalid SPS input', { code })
	}
	return result.data
}

/** HttpService can retain FetchError causes; strip them at this credential-bearing boundary. */
export async function protectSps<T>(operation: Promise<T>, retryableRead = true): Promise<T> {
	try {
		return await operation
	} catch (error) {
		const code = error instanceof ToolError ? error.code : 'upstream'
		const details: Record<string, unknown> = {}
		if (error instanceof ToolError) {
			for (const key of ['status', 'retry_after_ms', 'max_bytes', 'content_length']) {
				const value = error.details?.[key]
				if (typeof value === 'number' && Number.isFinite(value)) details[key] = value
			}
		}
		throw new ToolError(`SPS request failed (${code})`, {
			code,
			retryable: retryableRead && error instanceof ToolError && error.retryable,
			details
		})
	}
}

export function spsTransactionPath(path: string): string {
	return `/transactions/v5/data/${encodeObjectKeyPath(path.startsWith('/') ? path.slice(1) : path)}`
}

export function spsRenderBody(data: SpsJsonObject): string {
	const body = JSON.stringify(data)
	if (utf8ToBytes(body).byteLength > SPS_RENDER_MAX_BYTES) {
		throw new ToolError('SPS render body exceeds 8 MB', { code: 'too_large' })
	}
	return body
}

/** Pages use JSON array syntax, not repeated query keys or comma-joined values. */
export function spsRenderQuery(input: {
	perPage?: number | undefined
	pendingChange?: boolean | undefined
	startPackCount?: number | undefined
	totalPackCount?: number | undefined
	collate?: boolean | undefined
	copies?: number | undefined
	pages?: number[] | undefined
	asyncValidation?: boolean | undefined
	mediaType?: string | undefined
	printMode?: string | undefined
	dpi?: number | undefined
	zplCommand?: string | undefined
}): Record<string, HttpQueryValue> {
	if (input.dpi === 600 && input.zplCommand !== 'DY') {
		throw new ToolError('600 DPI requires the DY ZPL command', { code: 'bad_input' })
	}
	return {
		perPage: input.perPage,
		pendingChange: input.pendingChange,
		startPackCount: input.startPackCount,
		totalPackCount: input.totalPackCount,
		collate: input.collate,
		copies: input.copies,
		pages: input.pages && JSON.stringify(input.pages),
		asyncValidation: input.asyncValidation,
		mediaType: input.mediaType,
		printMode: input.printMode,
		dpi: input.dpi,
		zplCommand: input.zplCommand
	}
}

export function parseSpsJsonBytes(bytes: Uint8Array): unknown {
	try {
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
	} catch {
		throw new ToolError('Invalid SPS JSON document', { code: 'upstream' })
	}
}

export function spsDocumentUrl(value: string, origins: readonly string[]): string {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new ToolError('Invalid SPS document location', { code: 'upstream' })
	}
	if (url.protocol !== 'https:' || url.username || url.password || url.hash || !origins.includes(url.origin)) {
		throw new ToolError('SPS document origin is not approved', { code: 'forbidden' })
	}
	return url.href
}
