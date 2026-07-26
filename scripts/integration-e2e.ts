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

async function stackUp(): Promise<void> {
	log('up: compose (--wait) + supabase (parallel)')
	const [compose, supabase] = await Promise.all([
		$`docker compose -f ${composeFile} up -d --wait`.nothrow(),
		$`bunx supabase start`.nothrow()
	])
	if (compose.exitCode !== 0) {
		die(`docker compose up failed (exit ${compose.exitCode})`)
	}
	if (supabase.exitCode !== 0) {
		die(`bunx supabase start failed (exit ${supabase.exitCode})`)
	}
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
