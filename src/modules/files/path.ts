import { ToolError } from '../../core/errors'

/** Reject path segments that are parent references; allow names like `report..final.pdf`. */
function assertNoParentSegments(segments: string[], code: 'bad_auth' | 'bad_input'): void {
	for (const segment of segments) {
		if (segment === '..') {
			throw new ToolError(
				code === 'bad_auth'
					? 'root_prefix must not contain parent-directory segments'
					: 'Path must not contain parent-directory segments',
				{ code }
			)
		}
	}
}

/** Normalize root to a non-absolute prefix that always ends with `/`. */
export function normalizeRootPrefix(rootPrefix: string): string {
	let root = rootPrefix.trim().replaceAll('\\', '/')
	if (root.startsWith('/')) {
		throw new ToolError('root_prefix must not be absolute (no leading /)', { code: 'bad_auth' })
	}
	root = root.replace(/\/+/g, '/')
	const segments = root.split('/').filter((segment) => segment.length > 0 && segment !== '.')
	assertNoParentSegments(segments, 'bad_auth')
	if (segments.length === 0) {
		throw new ToolError('root_prefix must not be empty', { code: 'bad_auth' })
	}
	return `${segments.join('/')}/`
}

/** Resolve a model-facing relative key under root. Rejects escapes. */
export function resolveUnderRoot(root: string, relativePath: string): string {
	const rel = relativePath.trim().replaceAll('\\', '/').replace(/^\/+/, '')
	if (rel.length === 0) {
		throw new ToolError('Path must not be empty', { code: 'bad_input' })
	}
	if (rel.startsWith('/')) {
		throw new ToolError('Invalid path', { code: 'bad_input' })
	}
	const segments = rel.split('/').filter((segment) => segment.length > 0 && segment !== '.')
	assertNoParentSegments(segments, 'bad_input')
	if (segments.length === 0) {
		throw new ToolError('Path must not be empty', { code: 'bad_input' })
	}
	return `${root}${segments.join('/')}`
}

/** Prefix for listing (relative folder path, may be empty for root). */
export function resolveListPrefix(root: string, relativePath: string | undefined): string {
	if (!relativePath || !relativePath.trim()) return root
	const rel = relativePath.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
	const segments = rel.split('/').filter((segment) => segment.length > 0 && segment !== '.')
	assertNoParentSegments(segments, 'bad_input')
	if (segments.length === 0) return root
	return `${root}${segments.join('/')}/`
}

/** Map absolute object key back to relative, or undefined if outside root. */
export function toRelativeKey(root: string, absoluteKey: string): string | undefined {
	if (!absoluteKey.startsWith(root)) return undefined
	return absoluteKey.slice(root.length)
}

export function basename(relativeKey: string): string {
	const parts = relativeKey.replace(/\/+$/, '').split('/')
	const last = parts[parts.length - 1]
	return last ?? relativeKey
}
