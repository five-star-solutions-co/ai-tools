import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { envSetMany, formatEnvValue } from '../../scripts/lib/env-file'

describe('envSetMany', () => {
	test('updates existing keys in place and appends missing only', () => {
		const dir = mkdtempSync(join(tmpdir(), 'ai-tools-env-'))
		const file = join(dir, '.env')
		writeFileSync(
			file,
			[
				'# header',
				'AI_TOOLS_SUPABASE_URL=http://old.example',
				'AI_TOOLS_KEEP=stay',
				'',
				'# footer note',
				'AI_TOOLS_S3_BUCKET=old-bucket',
				''
			].join('\n'),
			'utf8'
		)

		envSetMany(file, [
			['AI_TOOLS_SUPABASE_URL', 'http://127.0.0.1:60121'],
			['AI_TOOLS_S3_BUCKET', 'ai-tools-it'],
			['AI_TOOLS_QDRANT_URL', 'http://127.0.0.1:6333']
		])

		const text = readFileSync(file, 'utf8')
		expect(text).toBe(
			[
				'# header',
				'AI_TOOLS_SUPABASE_URL=http://127.0.0.1:60121',
				'AI_TOOLS_KEEP=stay',
				'',
				'# footer note',
				'AI_TOOLS_S3_BUCKET=ai-tools-it',
				'AI_TOOLS_QDRANT_URL=http://127.0.0.1:6333',
				''
			].join('\n')
		)
	})

	test('removes duplicate keys for updated entries', () => {
		const dir = mkdtempSync(join(tmpdir(), 'ai-tools-env-'))
		const file = join(dir, '.env')
		writeFileSync(file, ['AI_TOOLS_SUPABASE_URL=one', 'OTHER=x', 'AI_TOOLS_SUPABASE_URL=two', ''].join('\n'), 'utf8')

		envSetMany(file, [['AI_TOOLS_SUPABASE_URL', 'http://127.0.0.1:60121']])

		const text = readFileSync(file, 'utf8')
		expect(text).toBe(['AI_TOOLS_SUPABASE_URL=http://127.0.0.1:60121', 'OTHER=x', ''].join('\n'))
		expect(text.match(/AI_TOOLS_SUPABASE_URL=/g)?.length).toBe(1)
	})

	test('formatEnvValue quotes when needed', () => {
		expect(formatEnvValue('plain')).toBe('plain')
		expect(formatEnvValue('has space')).toBe('"has space"')
		expect(formatEnvValue('a#b')).toBe('"a#b"')
	})
})
