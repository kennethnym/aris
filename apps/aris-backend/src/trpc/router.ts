import { initTRPC, TRPCError } from "@trpc/server"

import type { UserSessionManager } from "../session/index.ts"
import type { Context } from "./context.ts"

import { createLocationRouter } from "../location/router.ts"

export type TRPC = ReturnType<typeof createTRPC>

export interface TRPCRouterDeps {
	sessionManager: UserSessionManager
}

export function createTRPCRouter({ sessionManager }: TRPCRouterDeps) {
	const t = createTRPC()

	return t.router({
		location: createLocationRouter(t, { sessionManager }),
	})
}

export type TRPCRouter = ReturnType<typeof createTRPCRouter>

function createTRPC() {
	const t = initTRPC.context<Context>().create()

	const isAuthed = t.middleware(({ ctx, next }) => {
		if (!ctx.user || !ctx.session) {
			throw new TRPCError({ code: "UNAUTHORIZED" })
		}
		return next({
			ctx: {
				user: ctx.user,
				session: ctx.session,
			},
		})
	})

	return {
		router: t.router,
		procedure: t.procedure.use(isAuthed),
	}
}

