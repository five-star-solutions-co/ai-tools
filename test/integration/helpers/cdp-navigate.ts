/**
 * Minimal CDP navigation over WebSocket (no Playwright dependency).
 * Used by Bedrock AgentCore Browser live IT when an automation stream endpoint is returned.
 */

type CdpMessage = {
	id?: number
	method?: string
	params?: Record<string, unknown>
	result?: Record<string, unknown>
	sessionId?: string
	error?: { message?: string }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>
	}
	return undefined
}

/**
 * Connect to a CDP WebSocket endpoint and navigate the first page target to `url`.
 * Returns true if Page.navigate was accepted; false if the endpoint is unusable.
 */
export async function cdpNavigate(wsUrl: string, url: string, timeoutMs = 30_000): Promise<boolean> {
	if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) return false

	return await new Promise<boolean>((resolve) => {
		let settled = false
		let nextId = 1
		const pending = new Map<number, (msg: CdpMessage) => void>()
		let sessionId: string | undefined
		let navigated = false

		const finish = (ok: boolean) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			try {
				ws.close()
			} catch {
				// ignore
			}
			resolve(ok)
		}

		const timer = setTimeout(() => finish(navigated), timeoutMs)

		const ws = new WebSocket(wsUrl)

		const send = (method: string, params?: Record<string, unknown>, sid?: string) => {
			const id = nextId++
			const payload: CdpMessage = { id, method, ...(params && { params }) }
			if (sid) payload.sessionId = sid
			ws.send(JSON.stringify(payload))
			return new Promise<CdpMessage>((res) => {
				pending.set(id, res)
			})
		}

		ws.addEventListener('error', () => finish(false))
		ws.addEventListener('close', () => finish(navigated))

		ws.addEventListener('message', (event) => {
			const text = typeof event.data === 'string' ? event.data : String(event.data)
			let msg: CdpMessage
			try {
				msg = JSON.parse(text) as CdpMessage
			} catch {
				return
			}
			if (typeof msg.id === 'number') {
				const waiter = pending.get(msg.id)
				if (waiter) {
					pending.delete(msg.id)
					waiter(msg)
				}
			}
		})

		ws.addEventListener('open', () => {
			void (async () => {
				try {
					const targets = await send('Target.getTargets')
					if (targets.error) {
						finish(false)
						return
					}
					const list = targets.result?.['targetInfos']
					const infos = Array.isArray(list) ? list : []
					const page = infos.find((row) => {
						const r = asRecord(row)
						return r?.['type'] === 'page'
					})
					const targetId = asRecord(page)?.['targetId']
					if (typeof targetId !== 'string') {
						// Some endpoints expose a single page session already.
						const nav = await send('Page.navigate', { url })
						navigated = !nav.error
						finish(navigated)
						return
					}

					const attached = await send('Target.attachToTarget', { targetId, flatten: true })
					const sid = attached.result?.['sessionId']
					if (typeof sid === 'string') sessionId = sid

					await send('Page.enable', undefined, sessionId)
					const nav = await send('Page.navigate', { url }, sessionId)
					navigated = !nav.error
					// Brief settle for load; do not require loadEventFired (flaky on minimal pages).
					await new Promise((r) => setTimeout(r, 1_500))
					finish(navigated)
				} catch {
					finish(false)
				}
			})()
		})
	})
}
