import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import {
	gotenbergConvertTool,
	gotenbergModule,
	gotenbergRenderPdfTool,
	gotenbergRenderScreenshotTool
} from '../../src/vendors/gotenberg'

describe('gotenberg', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(gotenbergModule).ok).toBe(true)
		expect(gotenbergModule.auth.type).toBe('custom')
		expect(gotenbergModule.tools.map((t) => t.id).sort()).toEqual([
			'gotenberg-convert',
			'gotenberg-convert-batch',
			'gotenberg-render-pdf',
			'gotenberg-render-screenshot'
		])
		expect(gotenbergRenderPdfTool.id).toBe('gotenberg-render-pdf')
		expect(gotenbergRenderScreenshotTool.id).toBe('gotenberg-render-screenshot')
		expect(gotenbergConvertTool.id).toBe('gotenberg-convert')
	})
})
