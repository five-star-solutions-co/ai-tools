import { z } from 'zod'

/**
 * Host auth for Photon iMessage over **gRPC** (Node/Bun only), aligned with spectrum-ts cloud.
 *
 * Two layers (do not conflate):
 * 1. **Spectrum Cloud** — `project_id` + `project_secret` → temporary tokens
 *    (`POST /projects/{id}/imessage/tokens`), then gRPC to Photon’s managed hosts.
 * 2. **Direct gRPC** — `address` + temporary `token` when the host already has line credentials
 *    (same shape as spectrum-ts explicit `clients[]`).
 *
 * Flat object (not a Zod union) so seams can `.extend` for `provider` / `storage`.
 *
 * @see https://github.com/photon-hq/spectrum-ts/blob/main/packages/imessage/src/auth.ts
 * @see https://github.com/photon-hq/advanced-imessage-ts
 */
export const imessageAuthSchema = z
	.object({
		/** Spectrum Cloud project id (with project_secret). Preferred production path. */
		project_id: z.string().min(1).optional().describe('Spectrum / Photon project id'),
		project_secret: z
			.string()
			.min(1)
			.optional()
			.describe('Spectrum / Photon project secret (Basic auth to Spectrum Cloud)'),
		/**
		 * gRPC host:port for direct line access (e.g. imessage.spectrum.photon.codes:443 or
		 * {instanceId}.imsg.photon.codes:443). Required with `token`; omitted when using Spectrum Cloud
		 * (address is derived like spectrum-ts).
		 */
		address: z.string().min(1).optional().describe('gRPC host:port for direct Advanced iMessage connection'),
		/** Temporary iMessage bearer (not the project secret). Required for direct gRPC; Spectrum mints this. */
		token: z.string().min(1).optional().describe('Temporary iMessage gRPC bearer token'),
		/**
		 * Dedicated instance id. With Spectrum Cloud multi-instance responses, required to pick a line;
		 * gRPC address becomes `{server}.imsg.photon.codes:443`.
		 */
		server: z.string().min(1).optional().describe('Dedicated iMessage instance id (Spectrum dedicated routing)'),
		spectrum_cloud_url: z.url().optional().describe('Spectrum Cloud origin (default https://spectrum.photon.codes)'),
		/**
		 * Override shared gRPC host (spectrum-ts `SPECTRUM_IMESSAGE_ADDRESS`).
		 * Default `imessage.spectrum.photon.codes:443`.
		 */
		spectrum_imessage_address: z
			.string()
			.min(1)
			.optional()
			.describe('Shared gRPC host override (default imessage.spectrum.photon.codes:443)'),
		tls: z.boolean().optional().describe('gRPC TLS (default true; set false only for local plaintext)')
	})
	.superRefine((value, ctx) => {
		const hasProjectId = Boolean(value.project_id)
		const hasProjectSecret = Boolean(value.project_secret)
		if (hasProjectId !== hasProjectSecret) {
			ctx.addIssue({
				code: 'custom',
				message: 'project_id and project_secret must be provided together for Spectrum Cloud auth'
			})
		}
		if (hasProjectId) return
		if (!value.token || !value.address) {
			ctx.addIssue({
				code: 'custom',
				message:
					'Provide project_id + project_secret (Spectrum Cloud) or address + token (direct gRPC, spectrum-ts clients shape)'
			})
		}
	})

export type ImessageAuth = z.infer<typeof imessageAuthSchema>

export type ImessageSpectrumAuth = ImessageAuth & {
	project_id: string
	project_secret: string
}

/** Direct gRPC line credentials (host already minted a token). */
export type ImessageGrpcAuth = ImessageAuth & {
	address: string
	token: string
}

export function isImessageSpectrumAuth(auth: ImessageAuth): auth is ImessageSpectrumAuth {
	return Boolean(auth.project_id && auth.project_secret)
}

/** Aliases for hosts that want a named schema export (same base + refine). */
export const imessageSpectrumAuthSchema = imessageAuthSchema
export const imessageGrpcAuthSchema = imessageAuthSchema
/** @deprecated Use imessageGrpcAuthSchema — pack is gRPC-only. */
export const imessageMiddlewareAuthSchema = imessageAuthSchema

export const imessageChatActionSchema = z.enum([
	'typing',
	'upload_photo',
	'record_video',
	'upload_video',
	'record_voice',
	'upload_voice',
	'upload_document',
	'choose_sticker',
	'find_location',
	'record_video_note',
	'upload_video_note'
])

export const imessageSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid (e.g. any;-;alice@example.com)'),
	text: z.string().min(1).describe('Message text')
})

export const imessageMessageOutputSchema = z.object({
	message_id: z.string().min(1).describe('Message guid (provider id for journaling)'),
	space_id: z.string().describe('Chat guid (same as chat_id)')
})

export const imessageEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to edit'),
	text: z.string().min(1).describe('Replacement text')
})

export const imessageSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	action: imessageChatActionSchema.describe('Chat action; non-typing values map to typing start')
})

export const imessageSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to react to'),
	emoji: z
		.string()
		.min(1)
		.max(64)
		.describe(
			'Tapback name (love, like, dislike, laugh, emphasize, question) or an emoji character (maps to kind emoji)'
		)
})

export const imessageUnsendInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to unsend')
})

export const imessageReadInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional; Advanced iMessage markRead marks the whole chat (field kept for seam parity)')
})

export const imessageOkOutputSchema = z.object({
	ok: z.boolean(),
	space_id: z.string().optional()
})

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024

/**
 * Clear a reaction via setReaction(isSet=false).
 * `message_id` is the **target** message guid (not a reaction-message id).
 * `emoji` must match what was set (tapback name or emoji character).
 */
export const imessageClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Target message guid that was reacted to'),
	emoji: z.string().min(1).max(64).describe('Same tapback name or emoji used when setting the reaction')
})

export const imessageSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	kind: z.enum(['photo', 'document']).describe('Media kind (presentation)'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().optional().describe('Optional caption sent as a follow-up text message'),
	content_type: z.string().optional().describe('Optional MIME type; inferred from file_name when omitted')
})

export const imessageDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Attachment guid (from inbound payload or upload)'),
	file_name: z.string().min(1).optional().describe('Preferred file name for the download result'),
	chat_id: z.string().min(1).optional().describe('Chat guid (optional for attachment download; kept for seam parity)')
})

export const imessageDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

/**
 * Create (or resolve) a chat via Photon `chats.create`.
 * Host-only proactive / contact-delivery path — not auto-run before sendText.
 * One address = 1:1; two or more = group.
 */
export const imessageEnsureChatInputSchema = z.object({
	addresses: z
		.array(z.string().min(1))
		.min(1)
		.describe('Peer phone number(s) or email(s). One address creates a 1:1 chat; two or more create a group'),
	message: z.string().min(1).optional().describe('Optional opening text sent in the same create call'),
	client_message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional idempotency key for chat creation and the optional opening send')
})

export const imessageEnsureChatOutputSchema = z.object({
	chat_id: z.string().min(1).describe('Chat guid for later send, edit, react, or unsend'),
	message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Guid of the opening message when message was provided and the server returned one')
})

export type ImessageSendTextInput = z.infer<typeof imessageSendTextInputSchema>
export type ImessageMessageOutput = z.infer<typeof imessageMessageOutputSchema>
export type ImessageEditTextInput = z.infer<typeof imessageEditTextInputSchema>
export type ImessageSendChatActionInput = z.infer<typeof imessageSendChatActionInputSchema>
export type ImessageSetReactionInput = z.infer<typeof imessageSetReactionInputSchema>
export type ImessageUnsendInput = z.infer<typeof imessageUnsendInputSchema>
export type ImessageReadInput = z.infer<typeof imessageReadInputSchema>
export type ImessageClearReactionInput = z.infer<typeof imessageClearReactionInputSchema>
export type ImessageSendMediaInput = z.infer<typeof imessageSendMediaInputSchema>
export type ImessageDownloadFileInput = z.infer<typeof imessageDownloadFileInputSchema>
export type ImessageDownloadFileOutput = z.infer<typeof imessageDownloadFileOutputSchema>
export type ImessageEnsureChatInput = z.infer<typeof imessageEnsureChatInputSchema>
export type ImessageEnsureChatOutput = z.infer<typeof imessageEnsureChatOutputSchema>
