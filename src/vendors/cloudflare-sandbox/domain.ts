/**
 * Cloudflare Sandbox Bridge pure helpers (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { base64ToBytes, utf8ToBytes } from '../../shared/bytes'
import { MAX_FILE_BYTES } from './contracts'

/** Normalize a host path to the bridge URL segment under /file/… (no leading slash). */
export function workspaceFileKey(path: string): string {
	const trimmed = path.trim()
	if (!trimmed) {
		throw new ToolError('File path is empty', { code: 'bad_input' })
	}
	const noLead = trimmed.replace(/^\/+/, '')
	const under = noLead.startsWith('workspace/') ? noLead : `workspace/${noLead}`
	// Reject traversal
	const parts = under.split('/')
	if (parts.some((p) => p === '..' || p === '')) {
		throw new ToolError('File path must stay under workspace', {
			code: 'bad_input',
			details: { path: trimmed }
		})
	}
	return under
}

/** Absolute workspace path for shell list/rm (leading slash). */
export function workspaceAbsolutePath(path: string): string {
	const key = workspaceFileKey(path)
	return `/${key}`
}

/** Shell-safe single-quoted string. */
export function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * Resolve write-file body to raw bytes (text UTF-8 or base64).
 * Enforces MAX_FILE_BYTES (bridge limit).
 */
export function resolveWriteFileBytes(input: {
	text?: string | undefined
	body_base64?: string | undefined
}): Uint8Array {
	if (input.body_base64 !== undefined && input.text !== undefined) {
		throw new ToolError('Provide exactly one of text or body_base64', { code: 'bad_input' })
	}
	if (input.body_base64 !== undefined) {
		const bytes = base64ToBytes(input.body_base64)
		if (bytes.byteLength > MAX_FILE_BYTES) {
			throw new ToolError('Sandbox file exceeds max byte limit', {
				code: 'too_large',
				details: { max_bytes: MAX_FILE_BYTES, content_length: bytes.byteLength }
			})
		}
		return bytes
	}
	if (input.text !== undefined) {
		const bytes = utf8ToBytes(input.text)
		if (bytes.byteLength > MAX_FILE_BYTES) {
			throw new ToolError('Sandbox file exceeds max byte limit', {
				code: 'too_large',
				details: { max_bytes: MAX_FILE_BYTES, content_length: bytes.byteLength }
			})
		}
		return bytes
	}
	throw new ToolError('Provide exactly one of text or body_base64', { code: 'bad_input' })
}

export type ParsedExecStream = {
	stdout: string
	stderr: string
	exit_code?: number
	error?: string
	error_code?: string
}

export type ParseExecSseOptions = {
	/** Called for each stdout chunk as the SSE body is walked (buffer may still be complete). */
	onStdout?: (chunk: string) => void
	/** Called for each stderr chunk as the SSE body is walked. */
	onStderr?: (chunk: string) => void
}

/**
 * Parse bridge /exec text/event-stream body.
 * Events: stdout/stderr (base64 data), exit ({"exit_code":N}), error ({"error","code"}).
 */
export function parseExecSse(body: string, options: ParseExecSseOptions = {}): ParsedExecStream {
	const stdoutChunks: string[] = []
	const stderrChunks: string[] = []
	let exit_code: number | undefined
	let error: string | undefined
	let error_code: string | undefined

	const blocks = body.replaceAll('\r\n', '\n').split('\n\n')
	for (const block of blocks) {
		const lines = block.split('\n').filter((line) => line.length > 0)
		if (lines.length === 0) continue
		let event = 'message'
		const dataLines: string[] = []
		for (const line of lines) {
			if (line.startsWith('event:')) {
				event = line.slice(6).trim()
			} else if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).trimStart())
			}
		}
		const data = dataLines.join('\n')
		if (event === 'stdout' && data.length > 0) {
			const chunk = decodeBase64Chunk(data)
			stdoutChunks.push(chunk)
			options.onStdout?.(chunk)
		} else if (event === 'stderr' && data.length > 0) {
			const chunk = decodeBase64Chunk(data)
			stderrChunks.push(chunk)
			options.onStderr?.(chunk)
		} else if (event === 'exit' && data.length > 0) {
			const parsed = safeJson(data)
			if (isPlainObject(parsed)) {
				const code = parsed['exit_code']
				if (typeof code === 'number' && Number.isFinite(code)) exit_code = code
			}
		} else if (event === 'error' && data.length > 0) {
			const parsed = safeJson(data)
			if (isPlainObject(parsed)) {
				if (isString(parsed['error'])) error = parsed['error']
				if (isString(parsed['code'])) error_code = parsed['code']
			} else {
				error = data
			}
		}
	}

	const out: ParsedExecStream = {
		stdout: stdoutChunks.join(''),
		stderr: stderrChunks.join('')
	}
	if (exit_code !== undefined) out.exit_code = exit_code
	if (error !== undefined) out.error = error
	if (error_code !== undefined) out.error_code = error_code
	return out
}

function decodeBase64Chunk(data: string): string {
	try {
		// Bun/Node Buffer or atob
		if (typeof Buffer !== 'undefined') {
			return Buffer.from(data, 'base64').toString('utf8')
		}
		const binary = atob(data)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
		return new TextDecoder().decode(bytes)
	} catch {
		return data
	}
}

function safeJson(text: string): unknown {
	try {
		const value: unknown = JSON.parse(text)
		return value
	} catch {
		return undefined
	}
}

/** Build argv for executeCode over the bridge (no native runCode route). */
export function executeCodeArgv(language: string, code: string): string[] {
	switch (language) {
		case 'javascript':
		case 'typescript':
			return ['node', '-e', code]
		case 'shell':
			return ['sh', '-lc', code]
		case 'python':
		default:
			return ['python3', '-c', code]
	}
}
