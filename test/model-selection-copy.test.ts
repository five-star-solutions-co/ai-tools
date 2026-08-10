import { describe, expect, test } from 'bun:test'
import { codeSandboxExecuteCodeTool } from '../src/modules/code-sandbox'
import {
	cloudflareSandboxExecuteCodeTool,
	cloudflareSandboxExportArtifactTool
} from '../src/vendors/cloudflare-sandbox'

describe('model-facing tool selection copy', () => {
	test('positions code sandboxes as fallbacks rather than purpose-built builders', () => {
		expect(codeSandboxExecuteCodeTool.description).toContain('fallback')
		expect(cloudflareSandboxExecuteCodeTool.description).toContain('fallback')
		expect(cloudflareSandboxExecuteCodeTool.description).toContain('purpose-built tool')
	})

	test('does not export artifacts that are already durable', () => {
		expect(cloudflareSandboxExportArtifactTool.description).toContain('already final')
	})
})
