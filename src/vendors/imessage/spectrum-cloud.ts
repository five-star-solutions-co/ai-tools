/**
 * Spectrum Cloud iMessage token exchange + gRPC host resolution (spectrum-ts cloud path).
 *
 * project_id + project_secret → POST /projects/{id}/imessage/tokens → temporary bearer
 * (+ dedicated instance map) → createGrpcClient({ address, token }).
 *
 * @see https://github.com/photon-hq/spectrum-ts/blob/main/packages/core/src/utils/cloud.ts
 * @see https://github.com/photon-hq/spectrum-ts/blob/main/packages/imessage/src/auth.ts
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { HttpService } from '../../transport/http-service'
import type { FetchLike } from '../../core/types'
import type { ImessageSpectrumAuth } from './contracts'

export const DEFAULT_SPECTRUM_CLOUD_URL = 'https://spectrum.photon.codes'

/**
 * Shared-line gRPC host used by spectrum-ts (`SPECTRUM_IMESSAGE_ADDRESS` override).
 * @see packages/imessage/src/auth.ts in spectrum-ts
 */
export const DEFAULT_SPECTRUM_IMESSAGE_GRPC_ADDRESS = 'imessage.spectrum.photon.codes:443'

/** Refresh when less than this many ms remain (or 10% of TTL, whichever is larger, capped by TTL). */
const REFRESH_SKEW_MS = 60_000

export type SpectrumSharedTokenData = {
	type: 'shared'
	token: string
	expiresIn: number
}

export type SpectrumDedicatedTokenData = {
	type: 'dedicated'
	auth: Record<string, string>
	numbers: Record<string, string | null>
	expiresIn: number
}

export type SpectrumImessageTokenData = SpectrumSharedTokenData | SpectrumDedicatedTokenData

export type ResolvedSpectrumSession = {
	/** Temporary Advanced iMessage bearer. */
	token: string
	/** Dedicated instance id for x-photon-server; omit for shared. */
	server?: string
	expiresIn: number
	type: 'shared' | 'dedicated'
	/** Phone numbers by instance when dedicated (informational). */
	numbers?: Record<string, string | null>
}

export type SpectrumTokenSourceOptions = {
	/** Must include project_id + project_secret (Spectrum path). */
	auth: ImessageSpectrumAuth
	fetch?: FetchLike | undefined
	signal?: AbortSignal | undefined
}

function basicAuthHeader(projectId: string, projectSecret: string): string {
	const raw = `${projectId}:${projectSecret}`
	const encoded = typeof btoa === 'function' ? btoa(raw) : Buffer.from(raw, 'utf8').toString('base64')
	return `Basic ${encoded}`
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return isPlainObject(value) ? value : undefined
}

function parseExpiresIn(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value)
	if (isString(value) && /^\d+$/.test(value)) {
		const n = Number(value)
		if (n > 0) return n
	}
	// Conservative default if the cloud omits expiresIn
	return 3_600
}

/**
 * Parse Spectrum Cloud success body (`{ succeed, data }` or bare token payload).
 */
export function parseSpectrumTokenResponse(body: unknown): SpectrumImessageTokenData {
	const root = asRecord(body)
	if (!root) {
		throw new ToolError('Spectrum Cloud returned a non-object token response', { code: 'upstream' })
	}

	const payload = asRecord(root['data']) ?? root
	const type = payload['type']

	if (type === 'shared') {
		const token = payload['token']
		if (!isString(token) || token.length === 0) {
			throw new ToolError('Spectrum Cloud shared token response missing token', { code: 'upstream' })
		}
		return { type: 'shared', token, expiresIn: parseExpiresIn(payload['expiresIn'] ?? payload['expires_in']) }
	}

	if (type === 'dedicated') {
		const authRaw = asRecord(payload['auth'])
		if (!authRaw) {
			throw new ToolError('Spectrum Cloud dedicated token response missing auth map', { code: 'upstream' })
		}
		const auth: Record<string, string> = {}
		for (const [instanceId, token] of Object.entries(authRaw)) {
			if (isString(token) && token.length > 0) auth[instanceId] = token
		}
		if (Object.keys(auth).length === 0) {
			throw new ToolError('Spectrum Cloud dedicated token response has no instance tokens', {
				code: 'upstream'
			})
		}
		const numbersRaw = asRecord(payload['numbers'])
		const numbers: Record<string, string | null> = {}
		if (numbersRaw) {
			for (const [instanceId, phone] of Object.entries(numbersRaw)) {
				numbers[instanceId] = isString(phone) ? phone : null
			}
		}
		return {
			type: 'dedicated',
			auth,
			numbers,
			expiresIn: parseExpiresIn(payload['expiresIn'] ?? payload['expires_in'])
		}
	}

	throw new ToolError('Spectrum Cloud token response missing type shared|dedicated', {
		code: 'upstream',
		details: { type: type ?? null }
	})
}

/**
 * Map Spectrum token payload + optional preferred instance → session fields for createGrpcClient.
 */
export function resolveSpectrumSession(
	data: SpectrumImessageTokenData,
	preferredServer: string | undefined
): ResolvedSpectrumSession {
	if (data.type === 'shared') {
		if (preferredServer) {
			throw new ToolError('Spectrum Cloud returned shared routing; server (dedicated instance id) must be omitted', {
				code: 'bad_auth',
				details: { server: preferredServer }
			})
		}
		return { type: 'shared', token: data.token, expiresIn: data.expiresIn }
	}

	const instanceIds = Object.keys(data.auth)
	const server = preferredServer ?? (instanceIds.length === 1 ? instanceIds[0] : undefined)
	if (!server) {
		throw new ToolError('Spectrum Cloud returned multiple dedicated instances; set auth.server to the instance id', {
			code: 'bad_auth',
			details: { instance_ids: instanceIds }
		})
	}
	const token = data.auth[server]
	if (!token) {
		throw new ToolError('Spectrum Cloud dedicated response has no token for auth.server', {
			code: 'bad_auth',
			details: { server, instance_ids: instanceIds }
		})
	}
	return {
		type: 'dedicated',
		token,
		server,
		expiresIn: data.expiresIn,
		...(Object.keys(data.numbers).length > 0 && { numbers: data.numbers })
	}
}

/**
 * gRPC `address` spectrum-ts uses after token mint.
 * - shared → `imessage.spectrum.photon.codes:443` (or `spectrum_imessage_address`)
 * - dedicated → `{instanceId}.imsg.photon.codes:443`
 */
export function spectrumImessageGrpcAddress(
	session: ResolvedSpectrumSession,
	options: { sharedAddress?: string | undefined } = {}
): string {
	if (session.type === 'dedicated' && session.server) {
		return `${session.server}.imsg.photon.codes:443`
	}
	return options.sharedAddress?.trim() || DEFAULT_SPECTRUM_IMESSAGE_GRPC_ADDRESS
}

export async function issueImessageTokens(
	auth: ImessageSpectrumAuth,
	options: { fetch?: FetchLike; signal?: AbortSignal } = {}
): Promise<SpectrumImessageTokenData> {
	const baseURL = (auth.spectrum_cloud_url ?? DEFAULT_SPECTRUM_CLOUD_URL).replace(/\/$/, '')
	const http = new HttpService({
		baseURL,
		headers: {
			Authorization: basicAuthHeader(auth.project_id, auth.project_secret),
			Accept: 'application/json'
		},
		label: 'Spectrum Cloud',
		...(options.fetch && { fetch: options.fetch }),
		...(options.signal && { signal: options.signal })
	})

	const path = `/projects/${encodeURIComponent(auth.project_id)}/imessage/tokens`
	try {
		const { data } = await http.post(path, undefined, { label: 'Spectrum Cloud iMessage tokens' })
		return parseSpectrumTokenResponse(data)
	} catch (error) {
		if (error instanceof ToolError) throw error
		throw new ToolError('Spectrum Cloud iMessage token exchange failed', {
			code: 'upstream',
			cause: error
		})
	}
}

/**
 * Caches Spectrum temporary tokens and refreshes before expiry.
 * `getBearer` is safe to pass as createGrpcClient `token: async () => …`.
 */
export class SpectrumImessageTokenSource {
	readonly #auth: ImessageSpectrumAuth
	readonly #fetch: FetchLike | undefined
	readonly #signal: AbortSignal | undefined

	#session: ResolvedSpectrumSession | undefined
	#expiresAtMs = 0
	#refresh: Promise<ResolvedSpectrumSession> | undefined

	constructor(options: SpectrumTokenSourceOptions) {
		this.#auth = options.auth
		this.#fetch = options.fetch
		this.#signal = options.signal
	}

	/** Dedicated instance id after the first successful mint (undefined for shared). */
	get server(): string | undefined {
		return this.#session?.server
	}

	/** gRPC host:port for the current session (spectrum-ts routing). */
	get grpcAddress(): string | undefined {
		if (!this.#session) return undefined
		return spectrumImessageGrpcAddress(this.#session, {
			sharedAddress: this.#auth.spectrum_imessage_address
		})
	}

	/** Ensure a session exists; returns routing fields for createGrpcClient. */
	async ensureReady(): Promise<ResolvedSpectrumSession> {
		return this.#refreshIfNeeded()
	}

	/** Temporary bearer for Advanced iMessage gRPC. */
	async getBearer(): Promise<string> {
		const session = await this.#refreshIfNeeded()
		return session.token
	}

	async #refreshIfNeeded(): Promise<ResolvedSpectrumSession> {
		const now = Date.now()
		if (this.#session && now < this.#expiresAtMs) {
			return this.#session
		}
		if (!this.#refresh) {
			this.#refresh = this.#mint()
				.then((session) => {
					this.#session = session
					const skew = Math.min(REFRESH_SKEW_MS, Math.max(5_000, Math.floor(session.expiresIn * 100)))
					this.#expiresAtMs = Date.now() + Math.max(1_000, session.expiresIn * 1_000 - skew)
					return session
				})
				.finally(() => {
					this.#refresh = undefined
				})
		}
		return this.#refresh
	}

	async #mint(): Promise<ResolvedSpectrumSession> {
		const data = await issueImessageTokens(this.#auth, {
			...(this.#fetch && { fetch: this.#fetch }),
			...(this.#signal && { signal: this.#signal })
		})
		// Keep the same dedicated instance across refreshes when we already resolved one.
		const preferred = this.#session?.server ?? this.#auth.server
		return resolveSpectrumSession(data, preferred)
	}
}
