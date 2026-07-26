/**
 * Pure skill catalog helpers (no HTTP).
 */

import { isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { SkillDefinition, SkillSummary } from './contracts'

export function toSummary(skill: SkillDefinition): SkillSummary {
	const out: SkillSummary = {
		id: skill.id,
		title: skill.title,
		description: skill.description
	}
	if (skill.version !== undefined) out.version = skill.version
	if (skill.tags !== undefined) out.tags = skill.tags
	return out
}

export function listSkills(catalog: readonly SkillDefinition[], tag?: string): SkillSummary[] {
	const filtered =
		tag === undefined
			? catalog
			: catalog.filter((s) => (s.tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase()))
	return filtered.map(toSummary)
}

export function getSkill(catalog: readonly SkillDefinition[], id: string): SkillDefinition {
	const found = catalog.find((s) => s.id === id)
	if (!found) {
		throw new ToolError(`Skill not found: ${id}`, { code: 'not_found', details: { id } })
	}
	return found
}

function fieldScore(haystack: string, token: string, weight: number): number {
	return haystack.includes(token) ? weight : 0
}

function scoreSkill(skill: SkillDefinition, query: string, requiredTags: readonly string[]): number {
	const q = query.toLowerCase().trim()
	const tags = (skill.tags ?? []).map((t) => t.toLowerCase())
	for (const t of requiredTags) {
		if (!tags.includes(t.toLowerCase())) return -1
	}
	if (q.length === 0) return 0

	const id = skill.id.toLowerCase()
	const title = skill.title.toLowerCase()
	const description = skill.description.toLowerCase()
	const instructions = skill.instructions.toLowerCase()
	const tokens = q.split(/[\s/_-]+/).filter((t) => t.length > 0)

	let score = 0
	if (id === q) score += 100
	if (id.includes(q)) score += 40
	if (title.includes(q)) score += 30
	if (description.includes(q)) score += 20

	for (const token of tokens) {
		score += fieldScore(id, token, 25)
		score += fieldScore(title, token, 20)
		score += fieldScore(description, token, 12)
		if (tags.some((t) => t.includes(token))) score += 15
		score += fieldScore(instructions, token, 4)
		if (isString(skill.input_expectations)) {
			score += fieldScore(skill.input_expectations.toLowerCase(), token, 2)
		}
		if (isString(skill.output_expectations)) {
			score += fieldScore(skill.output_expectations.toLowerCase(), token, 2)
		}
	}
	return score
}

export function searchSkills(
	catalog: readonly SkillDefinition[],
	options: { query: string; tags?: readonly string[] | undefined; limit?: number | undefined }
): SkillSummary[] {
	const requiredTags = options.tags ?? []
	const limit = options.limit ?? 10
	const ranked = catalog
		.map((skill) => ({ skill, score: scoreSkill(skill, options.query, requiredTags) }))
		.filter((row) => row.score > 0)
		.sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))
		.slice(0, limit)
	return ranked.map((row) => toSummary(row.skill))
}
