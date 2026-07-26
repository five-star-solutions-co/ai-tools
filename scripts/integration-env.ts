#!/usr/bin/env bun
/**
 * Write local integration defaults + live Supabase status into `.env`.
 * Updates existing keys in place; appends only missing keys.
 *
 *   bun run integration:env
 *   (also run after `bun run integration:up` / inside `integration:e2e`)
 */

import { $ } from 'bun'
import { join } from 'node:path'

import { envSetMany } from './lib/env-file'

const root = join(import.meta.dir, '..')
const envFile = join(root, '.env')

function log(msg: string): void {
	console.log(`==> ${msg}`)
}

function die(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

export function parseStatusEnv(raw: string): { apiUrl: string; dbUrl: string; serviceRole: string } {
	const map = new Map<string, string>()
	for (const line of raw.split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
		if (!m?.[1]) continue
		let v = m[2] ?? ''
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1)
		}
		map.set(m[1], v)
	}
	const apiUrl = map.get('API_URL') ?? map.get('SUPABASE_URL') ?? ''
	const dbUrl = map.get('DB_URL') ?? map.get('POSTGRES_URL') ?? map.get('DATABASE_URL') ?? ''
	const serviceRole = map.get('SERVICE_ROLE_KEY') ?? map.get('SECRET_KEY') ?? map.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
	if (!apiUrl) die('could not parse API_URL from supabase status')
	if (!dbUrl) die('could not parse DB_URL from supabase status')
	if (!serviceRole) die('could not parse SERVICE_ROLE_KEY/SECRET_KEY from supabase status')
	return { apiUrl, dbUrl, serviceRole }
}

/** Compose-local defaults (idempotent) + Supabase keys from `supabase status -o env`. */
export async function writeIntegrationEnv(): Promise<void> {
	log('supabase status → .env (in-place upsert)')
	const status = await $`bunx supabase status -o env`.nothrow().quiet()
	if (status.exitCode !== 0) {
		die('bunx supabase status -o env failed (is supabase running? bun run integration:up)')
	}
	const text = status.stdout.toString()
	if (!text.trim()) die('supabase status -o env produced no output')

	const { apiUrl, dbUrl, serviceRole } = parseStatusEnv(text)

	envSetMany(envFile, [
		['AI_TOOLS_SUPABASE_URL', apiUrl],
		['AI_TOOLS_SUPABASE_API_KEY', serviceRole],
		['AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY', serviceRole],
		['AI_TOOLS_MASTRA_DB_URL', dbUrl],
		// Compose-local defaults
		['AI_TOOLS_QDRANT_URL', 'http://127.0.0.1:6333'],
		['AI_TOOLS_QDRANT_COLLECTION', 'ai_tools_it'],
		['AI_TOOLS_QDRANT_RAG_COLLECTION', 'ai_tools_rag_it'],
		['AI_TOOLS_S3_ACCESS_KEY_ID', 'aitools'],
		['AI_TOOLS_S3_SECRET_ACCESS_KEY', 'aitools-secret'],
		['AI_TOOLS_S3_REGION', 'us-east-1'],
		['AI_TOOLS_S3_BUCKET', 'ai-tools-it'],
		['AI_TOOLS_S3_ENDPOINT', 'http://127.0.0.1:9000'],
		['AI_TOOLS_GOTENBERG_BASE_URL', 'http://127.0.0.1:3000'],
		['AI_TOOLS_SUPABASE_STORAGE_BUCKET', 'ai-tools-it'],
		['AI_TOOLS_SUPABASE_VECTOR_TABLE', 'ai_tools_vectors'],
		['AI_TOOLS_SUPABASE_TABLE', 'ai_tools_vectors'],
		['AI_TOOLS_SUPABASE_MATCH_RPC', 'match_vectors'],
		['AI_TOOLS_SUPABASE_SCHEMA', 'public'],
		['AI_TOOLS_MASTRA_SCHEMA', 'public']
	])

	log('updated .env (values not printed)')
}

if (import.meta.main) {
	await writeIntegrationEnv()
}
