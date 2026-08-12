#!/usr/bin/env bun
/**
 * Local integration e2e:
 *   ensure compose + supabase (skip start when healthy)
 *   → write keys into .env in-place (no secret logging)
 *   → bun test --parallel [optional filters]
 *   → leave stack up by default (use --down for teardown)
 *
 *   bun run integration:e2e
 *   bun run integration:e2e -- --down
 *   bun run integration:e2e -- s3.live
 *   bun run integration:e2e -- test/integration/vendors/resend.live.test.ts
 *   bun run integration:e2e -- --no-up -t "round-trip"
 *
 * WebStorm: prefer `bun run integration:up` once, then run individual
 * `*.live.test.ts` files via the Bun test runner / gutter (not this script).
 * See docs/integration-tests.md.
 */

import { $ } from 'bun'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { writeIntegrationEnv } from './integration-env'
import { downStack, ensureStack, log } from './integration-stack'

const root = join(import.meta.dir, '..')
const envFile = join(root, '.env')
const maxConcurrency = navigator.hardwareConcurrency || 8
const defaultTestRoots = ['test/integration/vendors', 'test/integration/seams'] as const

process.chdir(root)

function die(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

function need(cmd: string): void {
	if (!Bun.which(cmd)) die(`missing required command: ${cmd}`)
}

type E2eFlags = {
	down: boolean
	noUp: boolean
	upOnly: boolean
	force: boolean
	help: boolean
}

function parseArgs(argv: string[]): { flags: E2eFlags; rest: string[] } {
	const flags: E2eFlags = {
		down: false,
		noUp: false,
		upOnly: false,
		force: false,
		help: false
	}
	const rest: string[] = []
	for (const arg of argv) {
		if (arg === '--down') flags.down = true
		else if (arg === '--no-up') flags.noUp = true
		else if (arg === '--up-only') flags.upOnly = true
		else if (arg === '--force') flags.force = true
		else if (arg === '--help' || arg === '-h') flags.help = true
		else rest.push(arg)
	}
	return { flags, rest }
}

function printHelp(): void {
	console.log(`usage: bun scripts/integration-e2e.ts [flags] [bun test args...]

flags:
  --down       Tear down compose + supabase after tests (default: leave running)
  --no-up      Skip stack ensure (tests only; stack must already be up)
  --up-only    Ensure stack + .env only; do not run tests
  --force      Force compose/supabase start even when healthy
  -h, --help   Show this help

bun test args:
  Any remaining args are passed to \`bun test\` (file globs, -t, etc.).
  If no path-like args are given, defaults to:
    test/integration/vendors test/integration/seams

examples:
  bun run integration:e2e
  bun run integration:e2e -- --down
  bun run integration:e2e -- s3.live qdrant.live
  bun run integration:e2e -- test/integration/vendors/s3.live.test.ts
  bun run integration:e2e -- --no-up -t "list put"

WebStorm / iterative:
  bun run integration:up          # once per session
  # then run individual *.live.test.ts from the IDE
  bun run integration:down        # when finished
`)
}

function loadEnvIntoProcess(): void {
	if (!existsSync(envFile)) return
	for (const line of readFileSync(envFile, 'utf8').split('\n')) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const eq = trimmed.indexOf('=')
		if (eq <= 0) continue
		const key = trimmed.slice(0, eq)
		let value = trimmed.slice(eq + 1)
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1)
		}
		process.env[key] = value
	}
}

/** Build bun test argv: user paths replace defaults; flags alone keep defaults. */
function buildTestArgs(rest: string[]): string[] {
	const hasPath = rest.some((a) => !a.startsWith('-'))
	if (hasPath) return rest
	return [...rest, ...defaultTestRoots]
}

async function runTests(rest: string[]): Promise<number> {
	const testArgs = buildTestArgs(rest)
	log(`test:integration (bun --parallel --max-concurrency=${maxConcurrency})`)
	if (testArgs.length > 0) log(`test args: ${testArgs.join(' ')}`)
	const result = await $`bun test --parallel --max-concurrency=${maxConcurrency} ${testArgs}`.nothrow()
	return result.exitCode ?? 1
}

async function main(): Promise<void> {
	const { flags, rest } = parseArgs(process.argv.slice(2))
	if (flags.help) {
		printHelp()
		process.exit(0)
	}

	need('docker')
	need('bun')

	let exitCode = 0
	try {
		if (!flags.noUp) {
			await ensureStack({ force: flags.force })
			await writeIntegrationEnv()
		} else {
			log('skip stack ensure (--no-up)')
		}
		loadEnvIntoProcess()

		if (flags.upOnly) {
			log('up-only: stack ready, skipping tests')
			exitCode = 0
		} else {
			exitCode = await runTests(rest)
			if (exitCode === 0) log('tests finished OK')
			else log('tests finished with failures')
		}
	} finally {
		if (flags.down) {
			await downStack()
		} else {
			log('stack left running (integration:down to stop; re-run e2e reuses healthy stack)')
		}
	}
	process.exit(exitCode)
}

await main()
