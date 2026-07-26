/**
 * Skills catalog client — host binds the resolved skill list.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	SkillDefinition,
	SkillsAuth,
	SkillsGetInput,
	SkillsGetOutput,
	SkillsListInput,
	SkillsListOutput,
	SkillsSearchInput,
	SkillsSearchOutput
} from './contracts'
import { skillsAuthSchema } from './contracts'
import { getSkill, listSkills, searchSkills } from './domain'

export class SkillsClient {
	readonly #catalog: readonly SkillDefinition[]

	constructor(auth: SkillsAuth) {
		const parsed = skillsAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid skills auth catalog', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#catalog = parsed.data.skills
	}

	static fromContext(ctx: ToolContext): SkillsClient {
		const auth = requireAuth(ctx, skillsAuthSchema)
		return new SkillsClient(auth)
	}

	list(input: SkillsListInput = {}): SkillsListOutput {
		return { skills: listSkills(this.#catalog, input.tag) }
	}

	get(input: SkillsGetInput): SkillsGetOutput {
		return { skill: getSkill(this.#catalog, input.id) }
	}

	search(input: SkillsSearchInput): SkillsSearchOutput {
		return {
			skills: searchSkills(this.#catalog, {
				query: input.query,
				...(input.tags && { tags: input.tags }),
				...(input.limit !== undefined && { limit: input.limit })
			})
		}
	}
}
