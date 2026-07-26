import { imageSize } from 'image-size'

export function readImageMetadata(bytes: Uint8Array): { width?: number; height?: number } | undefined {
	try {
		const dimensions = imageSize(bytes)
		if (!dimensions.width && !dimensions.height) return undefined
		return {
			...(dimensions.width && { width: dimensions.width }),
			...(dimensions.height && { height: dimensions.height })
		}
	} catch {
		return undefined
	}
}
