/**
 * Shared live helpers (vector round-trip + small utils).
 * Live tests are under test/integration/vendors|seams/*.live.test.ts
 */

import { expect } from 'bun:test'
import { trimEnd } from 'es-toolkit'

import type { VectorStoreOps } from '../../src/modules/vector-store'
import type { VectorMatch } from '../../src/vendors/_vector'
import { sleep, uniqueId } from './env'

export {
	IT,
	env,
	requireEnv,
	uniqueId,
	assertLocalUrl,
	sleep,
	awsCredentialsFromEnv,
	awsAccountIdFromEnv,
	textractBucket,
	textractSourceKey,
	sqsQueueUrlFromEnv,
	sqsQueueArnFromEnv,
	schedulerTargetArnFromEnv,
	schedulerRoleArnFromEnv,
	s3AuthFromEnv,
	cloudflareAuthFromEnv,
	supabaseAuthFromEnv,
	qdrantUrlFromEnv,
	qdrantCollectionFromEnv,
	qdrantRagCollectionFromEnv,
	qdrantApiKeyFromEnv,
	browserNavigateUrlFromEnv,
	browserSkipNavigateFromEnv,
	pineconeDimensionFromEnv,
	embedDimensionFromEnv,
	supabaseDimensionFromEnv
} from './env'
export { assertLocalUrl as assertLocalDbUrl } from './env'
export type { AwsCredentials, S3AuthFromEnv, CloudflareAuthFromEnv, SupabaseAuthFromEnv } from './env'

export const sampleVectorA = [0.12, 0.34, 0.56]
export const sampleVectorB = [0.11, 0.33, 0.55]

export async function assertUpsertQueryDeleteRoundTrip(
	ops: VectorStoreOps,
	options: {
		collection?: string | undefined
		namespace?: string | undefined
		values?: number[] | undefined
		settleMs?: number | undefined
	} = {}
): Promise<void> {
	const id = uniqueId('pt')
	const values = options.values ?? sampleVectorA
	const collection = options.collection
	const namespace = options.namespace
	const settleMs = options.settleMs ?? 200

	await ops.upsert({
		vectors: [{ id, values, metadata: { source: 'ai-tools-integration', id } }],
		...(collection ? { collection } : {}),
		...(namespace ? { namespace } : {})
	})

	await sleep(settleMs)

	const found = await ops.query({
		vector: values,
		top_k: 10,
		include_metadata: true,
		...(collection ? { collection } : {}),
		...(namespace ? { namespace } : {})
	})
	expectMatchContains(found.matches, id)

	await ops.delete({
		ids: [id],
		...(collection ? { collection } : {}),
		...(namespace ? { namespace } : {})
	})

	await sleep(settleMs)

	const after = await ops.query({
		vector: values,
		top_k: 10,
		...(collection ? { collection } : {}),
		...(namespace ? { namespace } : {})
	})
	expect(after.matches.every((m) => m.id !== id)).toBe(true)
}

export function expectMatchContains(matches: VectorMatch[], id: string): void {
	expect(matches.find((m) => m.id === id)).toBeDefined()
}

/**
 * Ensure a Qdrant collection exists at the given dimension.
 * Retries under parallel IT (another suite may create/delete concurrently).
 * Prefer separate collection names per dimension (smoke vs RAG) to avoid thrash.
 */
export async function ensureQdrantCollection(options: {
	baseUrl: string
	apiKey?: string | undefined
	collection: string
	dimension: number
}): Promise<void> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (options.apiKey) headers['api-key'] = options.apiKey
	const base = trimEnd(options.baseUrl, '/')
	const name = encodeURIComponent(options.collection)
	const url = `${base}/collections/${name}`

	const maxAttempts = 5
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const get = await fetch(url, { headers })
		if (get.status === 200) {
			const body: unknown = await get.json()
			const size = readQdrantCollectionDim(body)
			if (size === options.dimension) return
			// Wrong dim — drop and recreate (use separate collection names when possible)
			const del = await fetch(url, { method: 'DELETE', headers })
			if (!del.ok && del.status !== 404) {
				throw new Error(`Qdrant delete collection failed HTTP ${del.status}: ${await del.text()}`)
			}
			await sleep(50 * attempt)
		} else if (get.status !== 404) {
			throw new Error(`Qdrant get collection failed HTTP ${get.status}: ${await get.text()}`)
		}

		const create = await fetch(url, {
			method: 'PUT',
			headers,
			body: JSON.stringify({ vectors: { size: options.dimension, distance: 'Cosine' } })
		})
		if (create.ok || create.status === 409) {
			// 409 = already exists (race winner) — re-check dim on next loop / final verify
			const verify = await fetch(url, { headers })
			if (verify.status === 200) {
				const body: unknown = await verify.json()
				if (readQdrantCollectionDim(body) === options.dimension) return
			}
			await sleep(50 * attempt)
			continue
		}
		if (attempt === maxAttempts) {
			throw new Error(`Qdrant create collection failed HTTP ${create.status}: ${await create.text()}`)
		}
		await sleep(50 * attempt)
	}
	throw new Error(`Qdrant collection ${options.collection} not ready at dim ${options.dimension}`)
}

function readQdrantCollectionDim(body: unknown): number | undefined {
	if (!body || typeof body !== 'object') return undefined
	const result = (body as { result?: unknown }).result
	if (!result || typeof result !== 'object') return undefined
	const config = (result as { config?: unknown }).config
	if (!config || typeof config !== 'object') return undefined
	const params = (config as { params?: unknown }).params
	if (!params || typeof params !== 'object') return undefined
	const vectors = (params as { vectors?: unknown }).vectors
	if (!vectors || typeof vectors !== 'object') return undefined
	// Single vector config: { size, distance } or named map
	const size = (vectors as { size?: unknown }).size
	if (typeof size === 'number' && Number.isFinite(size)) return size
	for (const value of Object.values(vectors as Record<string, unknown>)) {
		if (value && typeof value === 'object' && typeof (value as { size?: unknown }).size === 'number') {
			return (value as { size: number }).size
		}
	}
	return undefined
}

export function objectKey(prefix = 'ai-tools-it'): string {
	return `${prefix}/${uniqueId('obj')}.txt`
}
