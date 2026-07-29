import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineTool, runTool, withHooksTool } from '../../src/core'
import { artifactRefSchema, findArtifactRefs } from '../../src/modules/artifacts'

const artifact = {
	store: 'host',
	key: 'turn/report.xlsx',
	media_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	filename: 'report.xlsx',
	byte_length: 42
} as const

describe('ArtifactRef output discovery', () => {
	test('finds unique nested ArtifactRefs without parsing presentation text', () => {
		const cyclic: Record<string, unknown> = {}
		cyclic['self'] = cyclic
		cyclic['artifact'] = artifact

		expect(
			findArtifactRefs({
				result: {
					primary: artifact,
					nested: [{ artifact }, { store: 'object', key: 'charts/chart.png' }]
				},
				presentation: '[report](artifact-ref:turn/report.xlsx)',
				invalid: { store: 'object', key: '' },
				cyclic
			})
		).toEqual([artifact, { store: 'object', key: 'charts/chart.png' }])
	})

	test('calls the host once per discovered ArtifactRef after output validation', async () => {
		const events: string[] = []
		const outputSchema = z.object({
			files: z.array(z.object({ artifact: artifactRefSchema }))
		})
		const tool = defineTool({
			id: 'test-build-files',
			name: 'testBuildFiles',
			description: 'Builds test files.',
			inputSchema: z.object({}),
			outputSchema,
			runtime: 'both',
			sideEffect: 'write',
			artifacts: true,
			execute: async () => ({
				files: [{ artifact }, { artifact }]
			})
		})
		const hooked = withHooksTool(tool, {
			onArtifact: ({ artifact: found, ctx }) => {
				expect(ctx.extras?.['turn_id']).toBe('turn-1')
				events.push(`artifact:${found.key}`)
			},
			afterExecute: () => {
				events.push('after')
			}
		})

		const output = await runTool(hooked, {}, { extras: { turn_id: 'turn-1' } })

		expect(output.files).toHaveLength(2)
		expect(events).toEqual(['artifact:turn/report.xlsx', 'after'])
	})

	test('routes artifact callback failures through onError', async () => {
		const errors: string[] = []
		const tool = defineTool({
			id: 'test-build-artifact',
			name: 'testBuildArtifact',
			description: 'Builds one test artifact.',
			inputSchema: z.object({}),
			outputSchema: z.object({ artifact: artifactRefSchema }),
			runtime: 'both',
			sideEffect: 'write',
			artifacts: true,
			execute: async () => ({ artifact })
		})
		const hooked = withHooksTool(tool, {
			onArtifact: () => {
				throw new Error('capture failed')
			},
			onError: ({ error }) => {
				errors.push(error instanceof Error ? error.message : 'unknown')
			}
		})

		let message: string | undefined
		try {
			await runTool(hooked, {})
		} catch (error) {
			if (error instanceof Error) message = error.message
		}
		expect(message).toBe('capture failed')
		expect(errors).toEqual(['capture failed'])
	})
})
