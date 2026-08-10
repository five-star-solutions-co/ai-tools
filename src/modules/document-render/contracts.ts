import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import {
	cloudflareBrowserAuthSchema,
	cloudflareBrowserRenderOutputSchema,
	cloudflareBrowserRenderPdfInputSchema,
	cloudflareBrowserRenderScreenshotInputSchema
} from '../../vendors/cloudflare-browser'

export const MAX_BATCH_RENDER = 10

/** Host auth: vendor credentials + provider discriminator. */
export const cloudflareBrowserDocumentRenderAuthSchema = cloudflareBrowserAuthSchema.extend({
	provider: z.literal('cloudflare-browser')
})

export type CloudflareBrowserDocumentRenderAuth = z.infer<typeof cloudflareBrowserDocumentRenderAuthSchema>

export const documentRenderAuthSchema = z.discriminatedUnion('provider', [cloudflareBrowserDocumentRenderAuthSchema])

export type DocumentRenderAuth = z.infer<typeof documentRenderAuthSchema>

/** Capability I/O — re-export Cloudflare Browser shapes under seam names. */
export const renderPdfInputSchema = cloudflareBrowserRenderPdfInputSchema
export const renderScreenshotInputSchema = cloudflareBrowserRenderScreenshotInputSchema
export const renderOutputSchema = cloudflareBrowserRenderOutputSchema

export const renderPdfBatchInputSchema = z.object({
	items: z.array(renderPdfInputSchema).min(1).max(MAX_BATCH_RENDER).describe('PDF render jobs (max 10)')
})

export const renderScreenshotBatchInputSchema = z.object({
	items: z.array(renderScreenshotInputSchema).min(1).max(MAX_BATCH_RENDER).describe('Screenshot jobs (max 10)')
})

export const renderPdfBatchOutputSchema = batchResultSchema(renderOutputSchema)
export const renderScreenshotBatchOutputSchema = batchResultSchema(renderOutputSchema)

export type RenderPdfInput = z.infer<typeof renderPdfInputSchema>
export type RenderScreenshotInput = z.infer<typeof renderScreenshotInputSchema>
export type RenderOutput = z.infer<typeof renderOutputSchema>
export type RenderPdfBatchInput = z.infer<typeof renderPdfBatchInputSchema>
export type RenderScreenshotBatchInput = z.infer<typeof renderScreenshotBatchInputSchema>
export type RenderPdfBatchOutput = z.infer<typeof renderPdfBatchOutputSchema>
export type RenderScreenshotBatchOutput = z.infer<typeof renderScreenshotBatchOutputSchema>

export type DocumentRenderOps = {
	renderPdf: (input: RenderPdfInput) => Promise<RenderOutput>
	renderScreenshot: (input: RenderScreenshotInput) => Promise<RenderOutput>
}
