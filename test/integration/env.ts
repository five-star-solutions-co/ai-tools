/**
 * Central env catalog for live integration tests.
 *
 * Only **secrets / dynamic host values** need env.
 * Local compose defaults and fixed AWS resource names are hardcoded;
 * queue URL / scheduler ARNs are derived from AWS account + region.
 *
 * See docs/integration-tests.md.
 */

/** Fixed package IT names (match scripts/aws-integration-setup.ts). */
export const IT = {
	aws: {
		defaultRegion: 'us-east-1',
		/** Region-scoped so recreate after delete is not blocked by global name recycle. */
		bucketForRegion(region: string): string {
			return `integration-test-ai-tools-${region}`
		},
		textractSourceKey: 'integration-test-ai-tools/textract/sample.pdf',
		queueName: 'integration-test-ai-tools-queue',
		schedulerRoleName: 'integration-test-ai-tools-scheduler-role'
	},
	/** Local MinIO from docker-compose.integration.yml */
	minio: {
		access_key_id: 'aitools',
		secret_access_key: 'aitools-secret',
		region: 'us-east-1',
		bucket: 'ai-tools-it',
		endpoint: 'http://127.0.0.1:9000'
	},
	qdrant: {
		url: 'http://127.0.0.1:6333',
		/** Dim-3 smoke collection for vector-store vendor/seam tests. */
		collection: 'ai_tools_it',
		/** Separate collection for RAG (embed dim) so parallel suites cannot race-recreate. */
		ragCollection: 'ai_tools_it_rag'
	},
	supabase: {
		table: 'ai_tools_vectors',
		schema: 'public',
		matchRpc: 'match_vectors',
		/** Matches docker/supabase migration vector(3) used by smoke + RAG IT. */
		dimension: 3
	},
	browser: {
		navigateUrl: 'https://example.com'
	},
	telegram: {
		webhookSecret: 'ai-tools-it-webhook-secret'
	},
	pinecone: {
		/** Live index dimension (must match AI_TOOLS_PINECONE_BASE_URL index). */
		dimension: 512
	},
	embed: {
		/** Default OpenAI-compatible dim; RAG overrides per store when needed. */
		dimension: 1536
	}
} as const

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

export type AwsCredentials = {
	access_key_id: string
	secret_access_key: string
	region: string
	session_token?: string
}

/**
 * Shared AWS IAM for all cloud AWS live IT.
 * Requires access key + secret; region defaults to us-east-1 (AgentCore).
 */
export function awsCredentialsFromEnv(): AwsCredentials | undefined {
	const access_key_id = env('AI_TOOLS_AWS_ACCESS_KEY_ID')
	const secret_access_key = env('AI_TOOLS_AWS_SECRET_ACCESS_KEY')
	if (!access_key_id || !secret_access_key) return undefined
	const region = env('AI_TOOLS_AWS_REGION') ?? IT.aws.defaultRegion
	const session_token = env('AI_TOOLS_AWS_SESSION_TOKEN')
	return {
		access_key_id,
		secret_access_key,
		region,
		...(session_token && { session_token })
	}
}

/**
 * AWS account id for deriving SQS URL + scheduler ARNs.
 * Prefer AI_TOOLS_AWS_ACCOUNT_ID (written by aws-integration-setup);
 * fall back to parsing AI_TOOLS_SQS_QUEUE_URL if present.
 */
export function awsAccountIdFromEnv(): string | undefined {
	const direct = env('AI_TOOLS_AWS_ACCOUNT_ID')
	if (direct) return direct
	const queueUrl = env('AI_TOOLS_SQS_QUEUE_URL')
	if (!queueUrl) return undefined
	const match = queueUrl.match(/\.amazonaws\.com\/(\d{12})\//)
	return match?.[1]
}

/** Textract sample bucket (region-scoped; created by aws-integration-setup). */
export function textractBucket(region?: string): string {
	const r = region ?? env('AI_TOOLS_AWS_REGION') ?? IT.aws.defaultRegion
	return IT.aws.bucketForRegion(r)
}

export function textractSourceKey(): string {
	return IT.aws.textractSourceKey
}

/** Derive SQS queue URL from account + region (or explicit override). */
export function sqsQueueUrlFromEnv(aws: AwsCredentials): string | undefined {
	const override = env('AI_TOOLS_SQS_QUEUE_URL')
	if (override) return override
	const account = awsAccountIdFromEnv()
	if (!account) return undefined
	return `https://sqs.${aws.region}.amazonaws.com/${account}/${IT.aws.queueName}`
}

export function sqsQueueArnFromEnv(aws: AwsCredentials): string | undefined {
	const url = sqsQueueUrlFromEnv(aws)
	if (!url) return undefined
	// https://sqs.{region}.amazonaws.com/{account}/{name}
	const match = url.match(/sqs\.([a-z0-9-]+)\.amazonaws\.com\/(\d{12})\/([^/?]+)/)
	if (!match?.[1] || !match[2] || !match[3]) return undefined
	return `arn:aws:sqs:${match[1]}:${match[2]}:${match[3]}`
}

/** Scheduler target = IT SQS queue ARN (setup wires role → this queue). */
export function schedulerTargetArnFromEnv(aws: AwsCredentials): string | undefined {
	return env('AI_TOOLS_SCHEDULER_TARGET_ARN') ?? sqsQueueArnFromEnv(aws)
}

export function schedulerRoleArnFromEnv(_aws?: AwsCredentials): string | undefined {
	const override = env('AI_TOOLS_SCHEDULER_ROLE_ARN')
	if (override) return override
	const account = awsAccountIdFromEnv()
	if (!account) return undefined
	return `arn:aws:iam::${account}:role/${IT.aws.schedulerRoleName}`
}

export type S3AuthFromEnv = {
	access_key_id: string
	secret_access_key: string
	region: string
	bucket: string
	endpoint?: string
	session_token?: string
}

/** Local MinIO — always compose defaults (never env). */
export function s3AuthFromEnv(): S3AuthFromEnv {
	return { ...IT.minio }
}

export type CloudflareAuthFromEnv = {
	account_id: string
	api_token: string
}

/** One Cloudflare account + API token for email + browser. */
export function cloudflareAuthFromEnv(): CloudflareAuthFromEnv | undefined {
	const account_id = env('AI_TOOLS_CF_ACCOUNT_ID')
	const api_token = env('AI_TOOLS_CF_API_TOKEN')
	if (!account_id || !api_token) return undefined
	return { account_id, api_token }
}

export type SupabaseAuthFromEnv = {
	url: string
	api_key: string
	table: string
	schema: string
	match_rpc: string
}

/** Supabase API (URL + service role). Table/schema/rpc are hardcoded. */
export function supabaseAuthFromEnv(): SupabaseAuthFromEnv | undefined {
	const url = env('AI_TOOLS_SUPABASE_URL')
	const api_key = env('AI_TOOLS_SUPABASE_API_KEY')
	if (!url || !api_key) return undefined
	return {
		url,
		api_key,
		table: IT.supabase.table,
		schema: IT.supabase.schema,
		match_rpc: IT.supabase.matchRpc
	}
}

/** Local Qdrant — always compose defaults (never env). */
export function qdrantUrlFromEnv(): string {
	return IT.qdrant.url
}

export function qdrantCollectionFromEnv(): string {
	return IT.qdrant.collection
}

/** Dedicated Qdrant collection for RAG (embed dim), isolated from dim-3 smoke. */
export function qdrantRagCollectionFromEnv(): string {
	return IT.qdrant.ragCollection
}

export function qdrantApiKeyFromEnv(): string | undefined {
	return undefined
}

/** Supabase pgvector column dimension for IT table. */
export function supabaseDimensionFromEnv(): number {
	return IT.supabase.dimension
}

export function browserNavigateUrlFromEnv(): string {
	return env('AI_TOOLS_BROWSER_NAVIGATE_URL') ?? IT.browser.navigateUrl
}

export function browserSkipNavigateFromEnv(): boolean {
	return env('AI_TOOLS_BROWSER_SKIP_NAVIGATE') === '1'
}

export function pineconeDimensionFromEnv(): number {
	const raw = env('AI_TOOLS_PINECONE_DIMENSION')
	if (!raw) return IT.pinecone.dimension
	const n = Number(raw)
	return Number.isFinite(n) ? n : IT.pinecone.dimension
}

export function embedDimensionFromEnv(): number {
	const raw = env('AI_TOOLS_EMBED_DIMENSION')
	if (!raw) return IT.embed.dimension
	const n = Number(raw)
	return Number.isFinite(n) ? n : IT.embed.dimension
}
