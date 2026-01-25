import type { Context, Next } from "hono"

import { auth } from "./index.ts"

type SessionUser = typeof auth.$Infer.Session.user
type Session = typeof auth.$Infer.Session.session

export interface SessionVariables {
	user: SessionUser | null
	session: Session | null
}

/**
 * Middleware that attaches session and user to the context.
 * Does not reject unauthenticated requests - use requireSession for that.
 */
export async function sessionMiddleware(c: Context, next: Next): Promise<void> {
	const session = await auth.api.getSession({ headers: c.req.raw.headers })

	if (session) {
		c.set("user", session.user)
		c.set("session", session.session)
	} else {
		c.set("user", null)
		c.set("session", null)
	}

	await next()
}

/**
 * Middleware that requires a valid session. Returns 401 if not authenticated.
 */
export async function requireSession(c: Context, next: Next): Promise<Response | void> {
	const session = await auth.api.getSession({ headers: c.req.raw.headers })

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401)
	}

	c.set("user", session.user)
	c.set("session", session.session)
	await next()
}

/**
 * Get session from headers. Useful for WebSocket upgrade validation.
 */
export async function getSessionFromHeaders(
	headers: Headers,
): Promise<{ user: SessionUser; session: Session } | null> {
	const session = await auth.api.getSession({ headers })
	return session
}
