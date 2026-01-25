import { initTRPC, TRPCError } from "@trpc/server"

import type { Context } from "./context.ts"

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

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

export const protectedProcedure = t.procedure.use(isAuthed)
