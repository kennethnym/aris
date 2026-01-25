import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"

import { auth } from "../auth/index.ts"

export async function createContext(opts: FetchCreateContextFnOptions) {
	const session = await auth.api.getSession({ headers: opts.req.headers })

	return {
		user: session?.user ?? null,
		session: session?.session ?? null,
	}
}

export type Context = Awaited<ReturnType<typeof createContext>>
