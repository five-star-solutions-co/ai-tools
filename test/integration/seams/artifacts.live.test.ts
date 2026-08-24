import { describe, expect, test } from 'bun:test'

import { ArtifactsClient } from '../../../src/modules/artifacts'
import type { ArtifactsOps } from '../../../src/modules/artifacts'
import { bytesToBase64, utf8ToBytes } from '../../../src/shared/bytes'
import { S3Client } from '../../../src/vendors/s3'
import { s3AuthFromEnv, uniqueId } from '../env'

const storage = s3AuthFromEnv()
const runObject = describe

/** Host-bound pure path — always runs (no external service). */
describe('live seam artifacts host binding', () => {
	test('create readRange readLines via host backend', async () => {
		const blobs = new Map<string, Uint8Array>()
		const backend: ArtifactsOps = {
			create: async (input) => {
				const bytes =
					input.encoding === 'base64' ? Uint8Array.from(Buffer.from(input.body, 'base64')) : utf8ToBytes(input.body)
				blobs.set(input.key, bytes)
				return {
					artifact: {
						store: 'host',
						key: input.key,
						...(input.media_type && { media_type: input.media_type }),
						byte_length: bytes.byteLength
					}
				}
			},
			readRange: async (input) => {
				const bytes = blobs.get(input.source.key)
				if (!bytes) throw new Error('missing')
				const slice = bytes.subarray(input.start_byte, input.end_byte + 1)
				return {
					source: input.source,
					body_base64: bytesToBase64(slice),
					start_byte: input.start_byte,
					end_byte: input.start_byte + Math.max(slice.byteLength, 1) - 1,
					total_bytes: bytes.byteLength
				}
			},
			readLines: async (input) => {
				const bytes = blobs.get(input.source.key)
				if (!bytes) throw new Error('missing')
				const lines = new TextDecoder().decode(bytes).split('\n')
				return {
					source: input.source,
					text: lines.join('\n'),
					start_line: 1,
					end_line: lines.length,
					total_lines: lines.length
				}
			}
		}

		const client = ArtifactsClient.fromAuth({ provider: 'host', backend })
		const created = await client.create({
			key: 'host-it/notes.txt',
			body: 'alpha\nbeta\ngamma',
			encoding: 'utf8',
			media_type: 'text/plain'
		})
		expect(created.artifact.store).toBe('host')

		const range = await client.readRange({
			source: created.artifact,
			start_byte: 6,
			end_byte: 9
		})
		expect(Buffer.from(range.body_base64, 'base64').toString('utf8')).toBe('beta')

		const lines = await client.readLines({ source: created.artifact })
		expect(lines.text).toBe('alpha\nbeta\ngamma')
	})
})

runObject('live seam artifacts object storage', () => {
	test(
		'create, bounded byte reads, and complete text reads on S3',
		async () => {
			const key = `ai-tools-artifacts-it/${uniqueId('artifact')}.txt`
			const client = ArtifactsClient.fromAuth({
				provider: 'object',
				storage: { ...storage }
			})
			const cleanup = new S3Client(storage)

			try {
				const created = await client.create({
					key,
					body: 'alpha\nbeta\ngamma',
					encoding: 'utf8',
					media_type: 'text/plain'
				})
				expect(created.artifact.store).toBe('object')

				const range = await client.readRange({
					source: created.artifact,
					start_byte: 6,
					end_byte: 9
				})
				expect(Buffer.from(range.body_base64, 'base64').toString('utf8')).toBe('beta')

				const lines = await client.readLines({ source: created.artifact })
				expect(lines.text).toBe('alpha\nbeta\ngamma')
			} finally {
				await cleanup.delete({ key }).catch(() => undefined)
			}
		},
		{ timeout: 60_000 }
	)
})
