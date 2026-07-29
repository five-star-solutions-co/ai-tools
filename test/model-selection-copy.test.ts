import { describe, expect, test } from 'bun:test'
import { documentBuildSpreadsheetTool, documentEditSpreadsheetTool } from '../src/modules/document'
import { documentEditSpreadsheetInputSchema } from '../src/modules/document/contracts'
import { codeSandboxExecuteCodeTool } from '../src/modules/code-sandbox'
import {
	cloudflareSandboxExecuteCodeTool,
	cloudflareSandboxExportArtifactTool
} from '../src/vendors/cloudflare-sandbox'

describe('model-facing tool selection copy', () => {
	test('prefers the structured spreadsheet builder and identifies its result as final', () => {
		expect(documentBuildSpreadsheetTool.description).toContain(
			'Prefer this over generating XLSX in a general code sandbox'
		)
		expect(documentBuildSpreadsheetTool.description).toContain('final ArtifactRef')
	})

	test('reserves spreadsheet editing for an existing workbook', () => {
		expect(documentEditSpreadsheetTool.description).toContain('existing XLSX or CSV')
		expect(documentEditSpreadsheetInputSchema.shape.source.description).toContain('pass { artifact: <ArtifactRef> }')
	})

	test('positions code sandboxes as fallbacks rather than document builders', () => {
		expect(codeSandboxExecuteCodeTool.description).toContain('fallback')
		expect(cloudflareSandboxExecuteCodeTool.description).toContain('fallback')
		expect(cloudflareSandboxExecuteCodeTool.description).toContain('purpose-built tool')
		expect(cloudflareSandboxExecuteCodeTool.description).toContain('documents, spreadsheets, presentations')
	})

	test('does not export artifacts that are already durable', () => {
		expect(cloudflareSandboxExportArtifactTool.description).toContain('Do not call for files returned by document')
		expect(cloudflareSandboxExportArtifactTool.description).toContain('already final')
	})
})
