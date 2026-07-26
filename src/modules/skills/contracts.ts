/**
 * Portable skill definitions + host-bound catalog auth.
 * Org assignment / persistence stays on the host.
 */

import { z } from 'zod'

export const MAX_SKILLS = 200
export const MAX_INSTRUCTIONS_CHARS = 100_000
export const MAX_SUPPORTING_FILES = 20
export const MAX_SUPPORTING_FILE_CHARS = 50_000
export const MAX_SEARCH_RESULTS = 50

const kebabId = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'Must be lowercase kebab-case')

export const skillSupportingFileSchema = z.object({
	path: z.string().min(1).max(512).describe('Relative path for the supporting file'),
	media_type: z.string().min(1).max(200).optional().describe('MIME type when known'),
	text: z.string().max(MAX_SUPPORTING_FILE_CHARS).optional().describe('Small text body for the supporting file')
})

export const skillDefinitionSchema = z.object({
	id: kebabId.describe('Stable skill id (kebab-case)'),
	title: z.string().min(1).max(200).describe('Short display title'),
	description: z.string().min(1).max(2_000).describe('When to use this skill'),
	instructions: z
		.string()
		.min(1)
		.max(MAX_INSTRUCTIONS_CHARS)
		.describe('Full skill instructions (markdown or plain text)'),
	version: z.string().min(1).max(64).optional().describe('Skill version string'),
	required_tool_ids: z.array(kebabId).max(100).optional().describe('Tool ids this skill expects to be available'),
	required_tags: z.array(z.string().min(1).max(64)).max(50).optional().describe('Required catalog tags'),
	tags: z.array(z.string().min(1).max(64)).max(50).optional().describe('Searchable tags'),
	input_expectations: z.string().max(5_000).optional().describe('What inputs the skill expects'),
	output_expectations: z.string().max(5_000).optional().describe('What outputs the skill should produce'),
	supporting_files: z
		.array(skillSupportingFileSchema)
		.max(MAX_SUPPORTING_FILES)
		.optional()
		.describe('Optional small supporting text files')
})

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>
export type SkillSupportingFile = z.infer<typeof skillSupportingFileSchema>

/** Host binds the resolved catalog for this agent/org run. */
export const skillsAuthSchema = z.object({
	skills: z
		.array(skillDefinitionSchema)
		.max(MAX_SKILLS)
		.describe('Host-resolved skill catalog for this bind (assignment stays host-side)')
})

export type SkillsAuth = z.infer<typeof skillsAuthSchema>

export const skillSummarySchema = z.object({
	id: z.string().describe('Skill id'),
	title: z.string().describe('Display title'),
	description: z.string().describe('When to use'),
	version: z.string().optional().describe('Version when set'),
	tags: z.array(z.string()).optional().describe('Tags when set')
})

export type SkillSummary = z.infer<typeof skillSummarySchema>

export const skillsListInputSchema = z.object({
	tag: z.string().min(1).max(64).optional().describe('Optional tag filter (exact match)')
})

export const skillsListOutputSchema = z.object({
	skills: z.array(skillSummarySchema).describe('Catalog summaries (instructions omitted)')
})

export const skillsGetInputSchema = z.object({
	id: kebabId.describe('Skill id to load')
})

export const skillsGetOutputSchema = z.object({
	skill: skillDefinitionSchema.describe('Full skill definition')
})

export const skillsSearchInputSchema = z.object({
	query: z.string().min(1).max(500).describe('Free-text query over title, description, tags, instructions'),
	tags: z.array(z.string().min(1).max(64)).max(20).optional().describe('Optional tags that must all match'),
	limit: z.int().min(1).max(MAX_SEARCH_RESULTS).optional().describe('Max results (default 10)')
})

export const skillsSearchOutputSchema = z.object({
	skills: z.array(skillSummarySchema).describe('Matching skill summaries, best first')
})

export type SkillsListInput = z.infer<typeof skillsListInputSchema>
export type SkillsListOutput = z.infer<typeof skillsListOutputSchema>
export type SkillsGetInput = z.infer<typeof skillsGetInputSchema>
export type SkillsGetOutput = z.infer<typeof skillsGetOutputSchema>
export type SkillsSearchInput = z.infer<typeof skillsSearchInputSchema>
export type SkillsSearchOutput = z.infer<typeof skillsSearchOutputSchema>
