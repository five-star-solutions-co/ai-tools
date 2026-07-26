import { flatMap, isPlainObject, isString } from 'es-toolkit'
import { toJSONSchema } from 'zod'

import { moduleSeamKeys } from '../generated/module-keys'
import type { ModuleDefinition, ToolDefinition } from './types'
import { duplicatesBy } from './unique'

const FORBIDDEN_MODEL_COPY =
	/\b(api[_ ]?key|apiKey|bearer token|process\.env|vault|secret key|authorization header|withAuth)\b/i

/**
 * Brand / vendor product names banned on **capability seam** model-facing copy
 * (module + tool description and input .describe()). Vendors may name their product.
 * Keep list brand-focused; avoid bare words like "teams" that appear in normal English.
 */
const FORBIDDEN_SEAM_BRAND_COPY =
	/\b(Telegram|Slack|iMessage|Resend|Cloudflare|Textract|Gotenberg|Pinecone|Qdrant|Supabase|WooCommerce|Katana|Amazon|Bot Framework|Microsoft Teams|Photon|Spectrum|Mastra|PgVector|OpenAI)\b|\bS3\b|\bR2\b/

/** Seam module ids from codegen (`src/modules/*` only — not hand-maintained). */
const SEAM_MODULE_IDS = new Set<string>(moduleSeamKeys)

const KEBAB_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export type ContractIssue = {
	code:
		| 'duplicate_tool_id'
		| 'empty_description'
		| 'empty_field_description'
		| 'forbidden_model_copy'
		| 'invalid_tool_id'
		| 'missing_name'
	message: string
	path: string
}

export type ContractResult = {
	ok: boolean
	issues: ContractIssue[]
}

export type CheckModelCopyOptions = {
	/** When true, also ban vendor brand names (capability seams). */
	seam?: boolean
}

function issue(path: string, code: ContractIssue['code'], message: string): ContractIssue {
	return { path, code, message }
}

function checkModelCopy(
	path: string,
	text: string,
	issues: ContractIssue[],
	options: CheckModelCopyOptions = {}
): void {
	const trimmed = text.trim()
	if (!trimmed) {
		issues.push(issue(path, 'empty_description', 'Model-facing description is empty'))
		return
	}
	if (FORBIDDEN_MODEL_COPY.test(trimmed)) {
		issues.push(
			issue(
				path,
				'forbidden_model_copy',
				'Model-facing copy must not mention credentials, env vars, vaults, or host wiring'
			)
		)
	}
	if (options.seam && FORBIDDEN_SEAM_BRAND_COPY.test(trimmed)) {
		issues.push(
			issue(
				path,
				'forbidden_model_copy',
				'Seam model-facing copy must not name vendors or products (use channel / bound store / provider-neutral language)'
			)
		)
	}
}

function fieldDescribes(
	schema: ToolDefinition['inputSchema'],
	path: string,
	issues: ContractIssue[],
	options: CheckModelCopyOptions = {}
): void {
	const properties = toJSONSchema(schema).properties
	if (!isPlainObject(properties)) return

	for (const [key, value] of Object.entries(properties)) {
		if (!isPlainObject(value)) continue
		const description = value['description']
		if (!isString(description) || description.trim().length === 0) {
			issues.push(
				issue(
					`${path}.input.${key}`,
					'empty_field_description',
					`Input field "${key}" is missing a .describe() for the model`
				)
			)
			continue
		}
		checkModelCopy(`${path}.input.${key}`, description, issues, options)
	}
}

export function validateTool(
	tool: ToolDefinition,
	pathPrefix = tool.id,
	options: CheckModelCopyOptions = {}
): ContractResult {
	const issues: ContractIssue[] = []

	if (!tool.id.trim() || !KEBAB_ID.test(tool.id)) {
		issues.push(issue(`${pathPrefix}.id`, 'invalid_tool_id', `Tool id must be kebab-case (got "${tool.id}")`))
	}
	if (!tool.name.trim()) {
		issues.push(issue(`${pathPrefix}.name`, 'missing_name', 'Tool name is required'))
	}
	checkModelCopy(`${pathPrefix}.description`, tool.description, issues, options)
	fieldDescribes(tool.inputSchema, pathPrefix, issues, options)

	return { ok: issues.length === 0, issues }
}

export function validateModule(module: ModuleDefinition): ContractResult {
	const issues: ContractIssue[] = []
	const seam = SEAM_MODULE_IDS.has(module.id)
	const copyOpts: CheckModelCopyOptions = seam ? { seam: true } : {}

	checkModelCopy(`module.${module.id}.description`, module.description, issues, copyOpts)

	for (const id of duplicatesBy(module.tools, (tool) => tool.id)) {
		issues.push(issue(`module.${module.id}.tools.${id}`, 'duplicate_tool_id', `Duplicate tool id "${id}"`))
	}

	issues.push(
		...flatMap(module.tools, (tool) => validateTool(tool, `module.${module.id}.tools.${tool.id}`, copyOpts).issues)
	)

	return { ok: issues.length === 0, issues }
}

export function assertContracts(result: ContractResult, label = 'contract'): void {
	if (result.ok) return
	const detail = result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')
	throw new Error(`${label} failed:\n${detail}`)
}
