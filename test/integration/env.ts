/**
 * Central env catalog for live integration tests.
 * Full matrix: docs/integration-tests.md
 */

export function env(name: string): string | undefined {
	const value = process.env[name]
	if (value === undefined || value.trim() === '') return undefined
	return value.trim()
}

export function requireEnv(name: string): string {
	const value = env(name)
	if (!value) throw new Error(`Missing required env: ${name}`)
	return value
}

export function uniqueId(prefix: string): string {
	return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}

export function assertLocalUrl(url: string, label: string): void {
	if (process.env.AI_TOOLS_ALLOW_REMOTE === '1') return
	if (url.includes('127.0.0.1') || url.includes('localhost')) return
	throw new Error(`${label} must be local unless AI_TOOLS_ALLOW_REMOTE=1`)
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Shared AWS IAM credentials for live IT (Textract, Bedrock, EventBridge Scheduler, SP-API SigV4).
 * **Not** used for MinIO — that stays on `AI_TOOLS_S3_*`.
 *
 * | Var | Role |
 * | --- | --- |
 * | `AI_TOOLS_AWS_ACCESS_KEY_ID` | required |
 * | `AI_TOOLS_AWS_SECRET_ACCESS_KEY` | required |
 * | `AI_TOOLS_AWS_REGION` | required (default region) |
 * | `AI_TOOLS_AWS_SESSION_TOKEN` | optional |
 *
 * Pass `regionEnv` to prefer a service-specific region (still falls back to `AI_TOOLS_AWS_REGION`).
 */
export function awsCredentialsFromEnv(options: { regionEnv?: string } = {}):
	| {
			access_key_id: string
			secret_access_key: string
			region: string
			session_token?: string
	  }
	| undefined {
	const access_key_id = env('AI_TOOLS_AWS_ACCESS_KEY_ID')
	const secret_access_key = env('AI_TOOLS_AWS_SECRET_ACCESS_KEY')
	const region = (options.regionEnv ? env(options.regionEnv) : undefined) ?? env('AI_TOOLS_AWS_REGION')
	if (!access_key_id || !secret_access_key || !region) return undefined
	const session_token = env('AI_TOOLS_AWS_SESSION_TOKEN')
	return {
		access_key_id,
		secret_access_key,
		region,
		...(session_token && { session_token })
	}
}

/** Shared object-storage auth from env (S3-compatible / MinIO). Do not reuse for real AWS APIs. */
export function s3AuthFromEnv(prefix = 'AI_TOOLS_S3') {
	const access_key_id = env(`${prefix}_ACCESS_KEY_ID`)
	const secret_access_key = env(`${prefix}_SECRET_ACCESS_KEY`)
	const region = env(`${prefix}_REGION`)
	const bucket = env(`${prefix}_BUCKET`)
	if (!access_key_id || !secret_access_key || !region || !bucket) return undefined
	const endpoint = env(`${prefix}_ENDPOINT`)
	const session_token = env(`${prefix}_SESSION_TOKEN`)
	return {
		access_key_id,
		secret_access_key,
		region,
		bucket,
		...(endpoint ? { endpoint } : {}),
		...(session_token ? { session_token } : {})
	}
}
