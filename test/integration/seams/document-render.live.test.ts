import { describe, expect, test } from 'bun:test'

import { runTool, withAuth } from '../../../src/core'
import { documentRenderModule, DocumentRenderClient } from '../../../src/modules/document-render'
import { cloudflareAuthFromEnv, s3AuthFromEnv } from '../helpers'

const storage = s3AuthFromEnv()
const cf = cloudflareAuthFromEnv()
const runCf = cf ? describe : describe.skip

runCf('live seam document-render (cloudflare-browser)', () => {
	test('renderPdf + renderScreenshot + batch tools', async () => {
		const auth = {
			provider: 'cloudflare-browser' as const,
			account_id: cf!.account_id,
			api_token: cf!.api_token,
			storage
		}
		const client = DocumentRenderClient.fromAuth(auth)
		const pdf = await client.renderPdf({
			source: { html: '<html><body><h1>document-render cf</h1></body></html>' },
			filename: 'doc-render-cf.pdf'
		})
		expect(pdf.kind).toBe('pdf')
		const shot = await client.renderScreenshot({
			source: { html: '<html><body><h1>document-render cf shot</h1></body></html>' },
			filename: 'doc-render-cf.png'
		})
		expect(shot.kind).toBe('screenshot')

		const bound = withAuth(documentRenderModule, auth)
		const pdfBatch = bound.tools.find((t) => t.id === 'document-render-pdf-batch')
		const shotBatch = bound.tools.find((t) => t.id === 'document-render-screenshot-batch')
		if (!pdfBatch || !shotBatch) throw new Error('missing document-render batch tools')

		const pdfBatchOut = (await runTool(pdfBatch, {
			items: [{ source: { html: '<html><body>batch pdf</body></html>' }, filename: 'doc-render-cf-batch.pdf' }]
		})) as { results: unknown[]; succeeded: number; failed: number }
		expect(pdfBatchOut.results.length).toBe(1)
		expect(pdfBatchOut.succeeded + pdfBatchOut.failed).toBe(1)

		const shotBatchOut = (await runTool(shotBatch, {
			items: [{ source: { html: '<html><body>batch shot</body></html>' }, filename: 'doc-render-cf-batch.png' }]
		})) as { results: unknown[]; succeeded: number; failed: number }
		expect(shotBatchOut.results.length).toBe(1)
		expect(shotBatchOut.succeeded + shotBatchOut.failed).toBe(1)
	})
})
