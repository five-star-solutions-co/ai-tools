#!/usr/bin/env bun
/**
 * Local integration stack (compose qdrant/minio + Supabase CLI).
 *
 *   bun run integration:up      # ensure + write .env (skips start when healthy)
 *   bun run integration:down
 *   bun run integration:status
 *
 * Shared by `integration:e2e` so WebStorm / selective `bun test` can leave the
 * stack up across many runs.
 */

import { $ } from 'bun'
import { join } from 'node:path'

import { writeIntegrationEnv } from './integration-env'

const root = join(import.meta.dir, '..')
const composeFile = 'docker-compose.integration.yml'

process.chdir(root)

export function log(msg: string): void {
	console.log(`==> ${msg}`)
}

function die(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

function need(cmd: string): void {
	if (!Bun.which(cmd)) die(`missing required command: ${cmd}`)
}

async function httpOk(url: string, timeoutMs = 1_500): Promise<boolean> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
		return res.ok
	} catch {
		return false
	}
}

/** Qdrant + MinIO healthy on fixed local ports. */
export async function isComposeHealthy(): Promise<boolean> {
	const [qdrant, minio] = await Promise.all([
		httpOk('http://127.0.0.1:6333/readyz'),
		httpOk('http://127.0.0.1:9000/minio/health/live')
	])
	return qdrant && minio
}

/** `supabase status -o env` has API_URL (or SUPABASE_URL). */
export async function isSupabaseReady(): Promise<boolean> {
	const status = await $`bunx supabase status -o env`.nothrow().quiet()
	if (status.exitCode !== 0) return false
	return /API_URL=|SUPABASE_URL=/.test(status.stdout.toString())
}

/** Wait until `supabase status -o env` succeeds (API_URL present). */
export async function waitSupabaseReady(timeoutMs = 180_000): Promise<void> {
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
 * Start Supabase only if not already ready.
 * `supabase start` is slow/noisy when already running.
 */
export async function ensureSupabase(options: { force?: boolean } = {}): Promise<void> {
	if (!options.force && (await isSupabaseReady())) {
		log('supabase already ready (skip start)')
		return
	}
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
 * Skips `up --wait` + init when qdrant/minio already healthy.
 */
export async function ensureCompose(options: { force?: boolean } = {}): Promise<void> {
	if (!options.force && (await isComposeHealthy())) {
		log('compose already healthy (qdrant + minio; skip up)')
		return
	}
	log('compose: qdrant minio (--wait)')
	const wait = await $`docker compose -f ${composeFile} up -d --wait qdrant minio`.nothrow()
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

export async function ensureStack(options: { force?: boolean } = {}): Promise<void> {
	need('docker')
	need('bun')
	log('up: compose + supabase (parallel; skip when healthy)')
	await Promise.all([ensureCompose(options), ensureSupabase(options)])
}

export async function downStack(): Promise<void> {
	need('docker')
	need('bun')
	log('down: compose + supabase (parallel)')
	await Promise.allSettled([
		$`docker compose -f ${composeFile} down --remove-orphans`.nothrow().quiet(),
		$`bunx supabase stop`.nothrow().quiet()
	])
	log('down done')
}

export async function printStatus(): Promise<void> {
	const [composeOk, supabaseOk] = await Promise.all([isComposeHealthy(), isSupabaseReady()])
	log(`compose healthy: ${composeOk ? 'yes' : 'no'}`)
	log(`supabase ready:  ${supabaseOk ? 'yes' : 'no'}`)
	await $`docker compose -f ${composeFile} ps`.nothrow()
	if (supabaseOk) {
		await $`bunx supabase status`.nothrow()
	}
}

async function main(): Promise<void> {
	const cmd = process.argv[2] ?? 'status'
	const force = process.argv.includes('--force')

	if (cmd === 'up') {
		await ensureStack({ force })
		await writeIntegrationEnv()
		return
	}
	if (cmd === 'down') {
		await downStack()
		return
	}
	if (cmd === 'status') {
		await printStatus()
		return
	}
	die(`unknown command: ${cmd} (use up | down | status)`)
}

if (import.meta.main) {
	await main()
}
