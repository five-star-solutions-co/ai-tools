import { describe, expect, test } from 'bun:test'

import { runTool, withAuth } from '../../../src/core'
import { documentRenderModule, DocumentRenderClient } from '../../../src/modules/document-render'
import { env, s3AuthFromEnv } from '../helpers'

const gotenbergUrl = env('AI_TOOLS_GOTENBERG_BASE_URL')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const runG = gotenbergUrl && storage ? describe : describe.skip

const cfAccount = env('AI_TOOLS_CF_BROWSER_ACCOUNT_ID') ?? env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const cfToken = env('AI_TOOLS_CF_BROWSER_API_TOKEN')
const runCf = cfAccount && cfToken && storage ? describe : describe.skip

function gotenbergAuth() {
	return {
		provider: 'gotenberg' as const,
		gotenberg_base_url: gotenbergUrl!,
		storage: storage!,
		...(env('AI_TOOLS_GOTENBERG_USER')
			? {
					gotenberg_api_username: env('AI_TOOLS_GOTENBERG_USER')!,
					gotenberg_api_password: env('AI_TOOLS_GOTENBERG_PASSWORD')!
				}
			: {})
	}
}

runG('live seam document-render (gotenberg)', () => {
	test('renderPdf + renderScreenshot + batch tools', async () => {
		const client = DocumentRenderClient.fromAuth(gotenbergAuth())
		const pdf = await client.renderPdf({
			source: { html: '<html><body><h1>document-render gotenberg</h1></body></html>' },
			filename: 'doc-render-g.pdf'
		})
		expect(pdf.kind).toBe('pdf')
		const shot = await client.renderScreenshot({
			source: { html: '<html><body><h1>document-render gotenberg shot</h1></body></html>' },
			filename: 'doc-render-g.png'
		})
		expect(shot.kind).toBe('screenshot')

		// Batch tools wrap the same client methods (module-level runBatchItems).
		const bound = withAuth(documentRenderModule, gotenbergAuth())
		const pdfBatch = bound.tools.find((t) => t.id === 'document-render-pdf-batch')
		const shotBatch = bound.tools.find((t) => t.id === 'document-render-screenshot-batch')
		if (!pdfBatch || !shotBatch) throw new Error('missing document-render batch tools')

		const pdfBatchOut = (await runTool(pdfBatch, {
			items: [{ source: { html: '<html><body>batch pdf</body></html>' }, filename: 'doc-render-g-batch.pdf' }]
		})) as { results: unknown[]; succeeded: number; failed: number }
		expect(pdfBatchOut.results.length).toBe(1)
		expect(pdfBatchOut.succeeded + pdfBatchOut.failed).toBe(1)

		const shotBatchOut = (await runTool(shotBatch, {
			items: [{ source: { html: '<html><body>batch shot</body></html>' }, filename: 'doc-render-g-batch.png' }]
		})) as { results: unknown[]; succeeded: number; failed: number }
		expect(shotBatchOut.results.length).toBe(1)
		expect(shotBatchOut.succeeded + shotBatchOut.failed).toBe(1)
	})
})

runCf('live seam document-render (cloudflare-browser)', () => {
	test('renderPdf + renderScreenshot', async () => {
		const client = DocumentRenderClient.fromAuth({
			provider: 'cloudflare-browser',
			account_id: cfAccount!,
			api_token: cfToken!,
			storage: storage!
		})
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
	})
})
