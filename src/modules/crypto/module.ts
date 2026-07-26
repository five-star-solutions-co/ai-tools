import { requireAuth } from '../../core/provider'
import { defineModule, defineTool } from '../../core/define'
import { bytesToBase64 } from '../../shared/bytes'
import {
	cryptoAuthSchema,
	cryptoHashInputSchema,
	cryptoHashOutputSchema,
	cryptoHmacSignInputSchema,
	cryptoHmacSignOutputSchema,
	cryptoHmacVerifyInputSchema,
	cryptoHmacVerifyOutputSchema,
	cryptoRandomBytesInputSchema,
	cryptoRandomBytesOutputSchema
} from './contracts'
import { hashData, signHmac, verifyHmac } from './domain'

export const cryptoHashTool = defineTool({
	id: 'crypto-hash',
	name: 'hashData',
	description: 'Compute a SHA-256, SHA-384, or SHA-512 digest for UTF-8 or base64 input.',
	inputSchema: cryptoHashInputSchema,
	outputSchema: cryptoHashOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => cryptoHashOutputSchema.parse({ digest_base64: await hashData(input) })
})

export const cryptoHmacSignTool = defineTool({
	id: 'crypto-hmac-sign',
	name: 'signHmac',
	description: 'Create an HMAC signature with a bound key id and the selected SHA-2 algorithm.',
	inputSchema: cryptoHmacSignInputSchema,
	outputSchema: cryptoHmacSignOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) =>
		cryptoHmacSignOutputSchema.parse({
			signature_base64: await signHmac(requireAuth(ctx, cryptoAuthSchema), input)
		})
})

export const cryptoHmacVerifyTool = defineTool({
	id: 'crypto-hmac-verify',
	name: 'verifyHmac',
	description: 'Verify a base64 HMAC signature with a bound key id and the selected SHA-2 algorithm.',
	inputSchema: cryptoHmacVerifyInputSchema,
	outputSchema: cryptoHmacVerifyOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) =>
		cryptoHmacVerifyOutputSchema.parse({
			valid: await verifyHmac(requireAuth(ctx, cryptoAuthSchema), input)
		})
})

export const cryptoRandomBytesTool = defineTool({
	id: 'crypto-random-bytes',
	name: 'generateRandomBytes',
	description: 'Generate up to 4096 cryptographically secure random bytes and return them as base64.',
	inputSchema: cryptoRandomBytesInputSchema,
	outputSchema: cryptoRandomBytesOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		const bytes = crypto.getRandomValues(new Uint8Array(input.byte_length))
		return cryptoRandomBytesOutputSchema.parse({ body_base64: bytesToBase64(bytes) })
	}
})

export const cryptoModule = defineModule({
	id: 'crypto',
	title: 'Crypto',
	description: 'Hash data, sign and verify HMAC values, and generate secure random bytes.',
	runtime: 'both',
	auth: { type: 'custom', schema: cryptoAuthSchema },
	tools: [cryptoHashTool, cryptoHmacSignTool, cryptoHmacVerifyTool, cryptoRandomBytesTool]
})
