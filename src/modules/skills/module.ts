import { defineModule, defineTool } from '../../core/define'
import { SkillsClient } from './client'
import {
	skillsAuthSchema,
	skillsGetInputSchema,
	skillsGetOutputSchema,
	skillsListInputSchema,
	skillsListOutputSchema,
	skillsSearchInputSchema,
	skillsSearchOutputSchema
} from './contracts'

export type { SkillsAuth } from './contracts'
export { skillsAuthSchema }

export const skillsListTool = defineTool({
	id: 'skills-list',
	name: 'listSkills',
	description:
		'List skills available in the bound catalog as short summaries (id, title, description, tags). Does not return full instructions. Optional tag filter.',
	inputSchema: skillsListInputSchema,
	outputSchema: skillsListOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => SkillsClient.fromContext(ctx).list(input)
})

export const skillsGetTool = defineTool({
	id: 'skills-get',
	name: 'getSkill',
	description:
		'Load one skill by id from the bound catalog, including full instructions, required tool ids, and supporting files when present.',
	inputSchema: skillsGetInputSchema,
	outputSchema: skillsGetOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => SkillsClient.fromContext(ctx).get(input)
})

export const skillsSearchTool = defineTool({
	id: 'skills-search',
	name: 'searchSkills',
	description:
		'Search the bound skill catalog by free text and optional tags. Returns matching summaries ordered by relevance. Use skills-get for full instructions.',
	inputSchema: skillsSearchInputSchema,
	outputSchema: skillsSearchOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => SkillsClient.fromContext(ctx).search(input)
})

export const skillsModule = defineModule({
	id: 'skills',
	title: 'Skills',
	description: 'List, search, and load portable skill definitions, including instructions and required tool ids.',
	runtime: 'both',
	auth: { type: 'custom', schema: skillsAuthSchema },
	categories: ['agent', 'skills'],
	classification: 'standard',
	tags: ['catalog'],
	tools: [skillsListTool, skillsGetTool, skillsSearchTool]
})
