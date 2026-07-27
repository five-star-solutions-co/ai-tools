#!/usr/bin/env bun
/**
 * Full local integration e2e (max parallel with Bun):
 *   compose + supabase up (parallel, compose --wait for health)
 *   → write keys into .env in-place (no secret logging)
 *   → bun test --parallel
 *   → compose + supabase down (parallel)
 *
 *   bun run integration:e2e
 */

import { $ } from 'bun'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { writeIntegrationEnv } from './integration-env'

const root = join(import.meta.dir, '..')
const envFile = join(root, '.env')
const composeFile = 'docker-compose.integration.yml'
const maxConcurrency = navigator.hardwareConcurrency || 8

process.chdir(root)

function log(msg: string): void {
	console.log(`==> ${msg}`)
}

function die(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

function need(cmd: string): void {
	if (!Bun.which(cmd)) die(`missing required command: ${cmd}`)
}

/** Wait until `supabase status -o env` succeeds (API_URL present). */
async function waitSupabaseReady(timeoutMs = 180_000): Promise<void> {
	const deadline = Date.now() + timeoutMs
	let lastErr = ''
	while (Date.now() < deadline) {
		const status = await $`bunx supabase status -o env`.nothrow().quiet()
		const out = status.stdout.toString()
		const err = status.stderr.toString()
		if (status.exitCode === 0 && /API_URL=|SUPABASE_URL=/.test(out)) {
			log('supabase ready')
			return
		}
		lastErr = (err || out).trim() || `exit ${status.exitCode}`
		await Bun.sleep(2_000)
	}
	die(`supabase not ready within ${timeoutMs / 1000}s: ${lastErr}`)
}

/**
 * Start Supabase (or accept "already running"), then poll until the DB/API are up.
 * `supabase start` often exits non-zero when already running or while db is still starting.
 */
async function ensureSupabase(): Promise<void> {
	log('supabase start')
	const started = await $`bunx supabase start`.nothrow()
	if (started.exitCode === 0) {
		log('supabase start ok')
	} else {
		const msg = (started.stderr.toString() || started.stdout.toString()).trim()
		log(`supabase start exit ${started.exitCode} (will wait for ready): ${msg.slice(0, 200)}`)
	}
	await waitSupabaseReady()
}

/**
 * Long-running compose services only. minio-init is one-shot (exits 0) and breaks
 * `docker compose up --wait` if included in the same wait set.
 */
async function ensureCompose(): Promise<void> {
	log('compose: qdrant minio gotenberg (--wait)')
	const wait = await $`docker compose -f ${composeFile} up -d --wait qdrant minio gotenberg`.nothrow()
	if (wait.exitCode !== 0) {
		const err = (wait.stderr.toString() || wait.stdout.toString()).trim()
		die(`docker compose up --wait failed (exit ${wait.exitCode}): ${err.slice(0, 400)}`)
	}
	log('compose: minio-init (bucket bootstrap)')
	const init = await $`docker compose -f ${composeFile} up --no-deps minio-init`.nothrow()
	if (init.exitCode !== 0) {
		const err = (init.stderr.toString() || init.stdout.toString()).trim()
		die(`minio-init failed (exit ${init.exitCode}): ${err.slice(0, 400)}`)
	}
}

async function stackUp(): Promise<void> {
	log('up: compose + supabase (parallel)')
	await Promise.all([ensureCompose(), ensureSupabase()])
}

async function stackDown(): Promise<void> {
	log('down: compose + supabase (parallel)')
	await Promise.allSettled([
		$`docker compose -f ${composeFile} down --remove-orphans`.nothrow().quiet(),
		$`bunx supabase stop`.nothrow().quiet()
	])
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

async function runTests(): Promise<number> {
	log(`test:integration (bun --parallel --max-concurrency=${maxConcurrency})`)
	const result =
		await $`bun test --parallel --max-concurrency=${maxConcurrency} test/integration/vendors test/integration/seams`.nothrow()
	return result.exitCode ?? 1
}

async function main(): Promise<void> {
	need('docker')
	need('bun')

	let exitCode = 0
	try {
		await stackUp()
		await writeIntegrationEnv()
		loadEnvIntoProcess()
		exitCode = await runTests()
		if (exitCode === 0) log('tests finished OK')
		else log('tests finished with failures')
	} finally {
		await stackDown()
	}
	process.exit(exitCode)
}

await main()
