/**
 * In-place .env upsert helpers (no secret logging).
 * Existing KEY=… lines are rewritten in place; missing keys are appended once.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** True when the line is an assignment for `key` (optional `export ` prefix). */
function assignmentKey(line: string): string | undefined {
	const trimmed = line.trimStart()
	if (!trimmed || trimmed.startsWith('#')) return undefined
	const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trimStart() : trimmed
	const eq = withoutExport.indexOf('=')
	if (eq <= 0) return undefined
	const key = withoutExport.slice(0, eq).trim()
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return undefined
	return key
}

/** Quote when needed so values with spaces / # / quotes stay valid. */
export function formatEnvValue(value: string): string {
	if (value === '' || /[\s#"'$`\\]/.test(value)) {
		return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
	}
	return value
}

/**
 * Upsert KEY=value pairs in an env file.
 * - If KEY already exists: replace that line's value in place (first occurrence).
 * - Later duplicate KEY lines for keys being set are removed.
 * - If KEY is missing: append once at the end.
 * Comments, blank lines, and unrelated keys are preserved.
 */
export function envSetMany(envFile: string, entries: ReadonlyArray<readonly [string, string]>): void {
	const updates = new Map(entries.map(([k, v]) => [k, v] as const))
	const remaining = new Set(updates.keys())
	const seen = new Set<string>()

	const existing = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
	const lines = existing.length > 0 ? existing.split('\n') : []
	// Drop a single trailing empty segment from a final newline so re-join is stable.
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop()
	}

	const out: string[] = []
	for (const line of lines) {
		const key = assignmentKey(line)
		if (key && updates.has(key)) {
			if (seen.has(key)) continue // drop duplicate assignment for this key
			seen.add(key)
			remaining.delete(key)
			const exportPrefix = line.trimStart().startsWith('export ') ? 'export ' : ''
			out.push(`${exportPrefix}${key}=${formatEnvValue(updates.get(key)!)}`)
			continue
		}
		out.push(line)
	}

	// Append only keys that were not present, in caller order.
	for (const [key, value] of entries) {
		if (!remaining.has(key)) continue
		out.push(`${key}=${formatEnvValue(value)}`)
		remaining.delete(key)
	}

	writeFileSync(envFile, `${out.join('\n')}\n`, 'utf8')
}
