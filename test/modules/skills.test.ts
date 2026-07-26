import { describe, expect, test } from 'bun:test'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { skillsGetTool, skillsListTool, skillsModule, skillsSearchTool } from '../../src/modules/skills'
import type { SkillDefinition } from '../../src/modules/skills'

const catalog: SkillDefinition[] = [
	{
		id: 'summarize-docs',
		title: 'Summarize documents',
		description: 'Summarize long documents into bullet points',
		instructions: 'Read the document then produce concise bullets.',
		version: '1.0.0',
		tags: ['docs', 'summary'],
		required_tool_ids: ['document-read']
	},
	{
		id: 'draft-email',
		title: 'Draft email',
		description: 'Draft a professional email from notes',
		instructions: 'Turn notes into a clear email body.',
		tags: ['email', 'writing'],
		required_tool_ids: ['email-send']
	}
]

const auth = { skills: catalog } as const

describe('skills', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(skillsModule).ok).toBe(true)
		expect(skillsModule.tools.map((t) => t.id).sort()).toEqual(['skills-get', 'skills-list', 'skills-search'])
	})

	test('list and get via withAuth', async () => {
		const bound = withAuth(skillsModule, auth)
		expect(bound.tools).toHaveLength(3)
		const list = await runTool(skillsListTool, {}, { auth })
		expect(list.skills).toHaveLength(2)
		expect(list.skills[0]?.id).toBeDefined()

		const one = await runTool(skillsGetTool, { id: 'summarize-docs' }, { auth })
		expect(one.skill.instructions).toContain('bullets')
		expect(one.skill.required_tool_ids).toEqual(['document-read'])
	})

	test('search ranks relevant skills', async () => {
		const result = await runTool(skillsSearchTool, { query: 'email draft', limit: 5 }, { auth })
		expect(result.skills[0]?.id).toBe('draft-email')
	})

	test('get unknown skill is not_found', async () => {
		try {
			await runTool(skillsGetTool, { id: 'nope' }, { auth })
			expect.unreachable('should throw')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('not_found')
		}
	})

	test('list filters by tag', async () => {
		const result = await runTool(skillsListTool, { tag: 'email' }, { auth })
		expect(result.skills).toHaveLength(1)
		expect(result.skills[0]?.id).toBe('draft-email')
	})
})
