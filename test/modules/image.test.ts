import { describe, expect, test } from 'bun:test'
import sharp from 'sharp'

import { validateModule } from '../../src/core'
import { ImageClient, imageModule } from '../../src/modules/image'
import { toArrayBuffer } from '../../src/shared/bytes'

const auth = {
	storage: {
		access_key_id: 'AKIAtest',
		secret_access_key: 'secret',
		region: 'us-east-1',
		bucket: 'files'
	}
} as const

function objectStore(initial: Record<string, Uint8Array>) {
	const objects = new Map(Object.entries(initial))
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(input, init)
		const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''))
		if (request.method === 'HEAD') {
			const value = objects.get(key)
			return value
				? new Response(null, {
						status: 200,
						headers: { 'content-length': String(value.byteLength), 'content-type': 'image/png' }
					})
				: new Response(null, { status: 404 })
		}
		if (request.method === 'GET') {
			const value = objects.get(key)
			return value ? new Response(toArrayBuffer(value)) : new Response(null, { status: 404 })
		}
		if (request.method === 'PUT') {
			objects.set(key, new Uint8Array(await request.arrayBuffer()))
			return new Response(null, { status: 200 })
		}
		return new Response(`unexpected ${request.method}`, { status: 500 })
	}
	return { objects, fetch }
}

const source = { store: 'object', key: 'source.png', media_type: 'image/png' } as const

describe('image', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(imageModule).ok).toBe(true)
		expect(imageModule.tools.map((tool) => tool.id).sort()).toEqual([
			'image-convert',
			'image-crop',
			'image-metadata',
			'image-resize',
			'image-thumbnail'
		])
	})

	test('metadata, resize, crop, thumbnail, and format conversion use sharp', async () => {
		const input = await sharp({
			create: { width: 40, height: 30, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } }
		})
			.png()
			.toBuffer()
		const store = objectStore({ 'source.png': input })
		const client = ImageClient.fromAuth(auth, { fetch: store.fetch })

		const metadata = await client.metadata({ source })
		expect(metadata).toMatchObject({ format: 'png', width: 40, height: 30, has_alpha: true })

		const resized = await client.resize({ source, width: 20, output_key: 'resized.png' })
		expect(resized.image).toMatchObject({ width: 20, height: 15, format: 'png' })

		const cropped = await client.crop({
			source,
			left: 2,
			top: 3,
			width: 10,
			height: 8,
			output_key: 'cropped.png'
		})
		expect(cropped.image).toMatchObject({ width: 10, height: 8 })

		const thumbnail = await client.thumbnail({ source, width: 12, height: 12, output_key: 'thumb.png' })
		expect(thumbnail.image).toMatchObject({ width: 12, height: 9 })

		const converted = await client.convert({ source, format: 'webp', quality: 80, output_key: 'converted.webp' })
		expect(converted.result.media_type).toBe('image/webp')
		expect((await sharp(store.objects.get('converted.webp')!).metadata()).format).toBe('webp')
	})
})
