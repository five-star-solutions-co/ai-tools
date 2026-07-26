import { describe, expect, test } from 'bun:test'

import { SkillsClient } from '../../../src/modules/skills'
import type { SkillDefinition } from '../../../src/modules/skills'

/** Catalog-bound pure seam — always runs (no external service). */
const catalog: SkillDefinition[] = [
	{
		id: 'it-summarize',
		title: 'Summarize',
		description: 'Summarize text into bullets',
		instructions: 'Produce concise bullet points.',
		tags: ['docs'],
		required_tool_ids: ['document-read']
	},
	{
		id: 'it-draft',
		title: 'Draft email',
		description: 'Draft a short email',
		instructions: 'Write a clear email body.',
		tags: ['email'],
		required_tool_ids: ['email-send']
	}
]

describe('live seam skills', () => {
	test('list search get via bound catalog', () => {
		const client = new SkillsClient({ skills: catalog })
		const listed = client.list({})
		expect(listed.skills.length).toBe(2)

		const found = client.search({ query: 'email draft', limit: 5 })
		expect(found.skills[0]?.id).toBe('it-draft')

		const one = client.get({ id: 'it-summarize' })
		expect(one.skill.instructions).toContain('bullet')
	})
})
