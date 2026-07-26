import { z } from 'zod'

export const MAX_CRYPTO_INPUT_CHARS = 1_400_000

export const cryptoAuthSchema = z.object({
	hmac_keys: z.record(z.string().min(1), z.string().min(1)).describe('Base64 HMAC keys indexed by host-defined id')
})

export const cryptoAlgorithmSchema = z.enum(['SHA-256', 'SHA-384', 'SHA-512'])

const encodedBodySchema = z.object({
	body: z.string().max(MAX_CRYPTO_INPUT_CHARS).describe('Data encoded as specified by encoding'),
	encoding: z.enum(['utf8', 'base64']).describe('How body is encoded')
})

export const cryptoHashInputSchema = encodedBodySchema.extend({
	algorithm: cryptoAlgorithmSchema.describe('SHA-2 digest algorithm')
})

export const cryptoHashOutputSchema = z.object({
	digest_base64: z.string().describe('Digest encoded as base64')
})

export const cryptoHmacSignInputSchema = encodedBodySchema.extend({
	key_id: z.string().min(1).describe('Identifier of a bound signing key'),
	algorithm: cryptoAlgorithmSchema.describe('SHA-2 HMAC algorithm')
})

export const cryptoHmacSignOutputSchema = z.object({
	signature_base64: z.string().describe('HMAC signature encoded as base64')
})

export const cryptoHmacVerifyInputSchema = cryptoHmacSignInputSchema.extend({
	signature_base64: z.string().min(1).describe('Base64 HMAC signature to verify')
})

export const cryptoHmacVerifyOutputSchema = z.object({
	valid: z.boolean()
})

export const cryptoRandomBytesInputSchema = z.object({
	byte_length: z.int().min(1).max(4_096).describe('Number of random bytes to generate')
})

export const cryptoRandomBytesOutputSchema = z.object({
	body_base64: z.string().describe('Random bytes encoded as base64')
})

export type CryptoAuth = z.infer<typeof cryptoAuthSchema>
export type CryptoAlgorithm = z.infer<typeof cryptoAlgorithmSchema>
export type CryptoHashInput = z.infer<typeof cryptoHashInputSchema>
export type CryptoHmacSignInput = z.infer<typeof cryptoHmacSignInputSchema>
export type CryptoHmacVerifyInput = z.infer<typeof cryptoHmacVerifyInputSchema>
export type CryptoRandomBytesInput = z.infer<typeof cryptoRandomBytesInputSchema>
