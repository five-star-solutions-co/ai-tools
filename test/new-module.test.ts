import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

const repoRoot = path.resolve(import.meta.dir, '..')

describe('new-module scaffold', () => {
	test('rejects invalid keys without writing', async () => {
		const proc = Bun.spawn(['bun', 'scripts/new-module.ts', 'Not_Valid'], {
			cwd: repoRoot,
			stdout: 'pipe',
			stderr: 'pipe'
		})
		const code = await proc.exited
		const err = await new Response(proc.stderr).text()
		expect(code).not.toBe(0)
		expect(err).toContain('kebab-case')
	})

	test('help exits cleanly', async () => {
		const proc = Bun.spawn(['bun', 'scripts/new-module.ts', '--help'], {
			cwd: repoRoot,
			stdout: 'pipe',
			stderr: 'pipe'
		})
		const code = await proc.exited
		const out = await new Response(proc.stdout).text()
		expect(code).toBe(0)
		expect(out).toContain('Usage:')
	})

	test('refuses existing modules', async () => {
		const proc = Bun.spawn(['bun', 'scripts/new-module.ts', 'content-type'], {
			cwd: repoRoot,
			stdout: 'pipe',
			stderr: 'pipe'
		})
		const code = await proc.exited
		const err = await new Response(proc.stderr).text()
		expect(code).not.toBe(0)
		expect(err).toContain('already exists')
	})
})

describe('new-module script source', () => {
	test('documents flags and uses runCodegen', async () => {
		const source = await readFile(path.join(repoRoot, 'scripts/new-module.ts'), 'utf8')
		expect(source).toContain('--title')
		expect(source).toContain('--auth')
		expect(source).toContain('runCodegen')
		expect(source).toContain('src/modules')
		expect(source).toContain('docs/modules')
		expect(source).toContain('renderDocsMd')
	})
})
