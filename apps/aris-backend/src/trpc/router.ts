import { initTRPC, TRPCError } from "@trpc/server"

import { createLocationRouter } from "../location/router.ts"
import type { LocationService } from "../location/service.ts"
import type { Context } from "./context.ts"

interface AuthedContext {
	user: NonNullable<Context["user"]>
	session: NonNullable<Context["session"]>
}

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

export type TRPC = ReturnType<typeof createTRPC>

export interface TRPCRouterDeps {
	locationService: LocationService
}

export function createTRPCRouter({ locationService }: TRPCRouterDeps) {
	const t = createTRPC()

	return t.router({
		location: createLocationRouter(t, { locationService }),
	})
}

export type TRPCRouter = ReturnType<typeof createTRPCRouter>
