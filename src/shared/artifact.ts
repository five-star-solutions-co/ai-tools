import { isPlainObject } from 'es-toolkit'
import { z } from 'zod'

/** Durable blob handle — bytes never pass through the LLM. */
export const artifactRefSchema = z.object({
	store: z
		.enum(['object', 'host'])
		.describe('Who owns the bytes. object = bound object storage; host = host-mapped key'),
	key: z.string().min(1).describe('Object key (or host id when store is host)'),
	media_type: z.string().min(1).optional().describe('MIME or format hint when known'),
	filename: z.string().min(1).optional().describe('Original or display file name'),
	byte_length: z.int().min(0).optional().describe('Size in bytes when known')
})

export type ArtifactRef = z.infer<typeof artifactRefSchema>

/** Find unique ArtifactRefs in a structured tool output, in depth-first order. */
export function findArtifactRefs(output: unknown): ArtifactRef[] {
	const artifacts: ArtifactRef[] = []
	const identities = new Set<string>()
	const visited = new WeakSet<object>()

	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			if (visited.has(value)) return
			visited.add(value)
			for (const item of value) visit(item)
			return
		}
		if (!isPlainObject(value)) return
		if (visited.has(value)) return
		visited.add(value)

		const parsed = artifactRefSchema.safeParse(value)
		if (parsed.success) {
			const identity = JSON.stringify([parsed.data.store, parsed.data.key])
			if (!identities.has(identity)) {
				identities.add(identity)
				artifacts.push(parsed.data)
			}
			return
		}

		for (const item of Object.values(value)) visit(item)
	}

	visit(output)
	return artifacts
}
