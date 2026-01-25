import { TRPCError } from "@trpc/server"
import { type } from "arktype"

import { UserNotFoundError } from "../lib/error.ts"
import type { TRPC } from "../trpc/router.ts"
import type { LocationService } from "./service.ts"

const locationInput = type({
	lat: "number",
	lng: "number",
	accuracy: "number",
	timestamp: "Date",
})

export function createLocationRouter(t: TRPC, { locationService }: { locationService: LocationService }) {
	return t.router({
		update: t.procedure.input(locationInput).mutation(({ input, ctx }) => {
			try {
				locationService.updateUserLocation(ctx.user.id, {
					lat: input.lat,
					lng: input.lng,
					accuracy: input.accuracy,
					timestamp: input.timestamp,
				})
			} catch (error) {
				if (error instanceof UserNotFoundError) {
					throw new TRPCError({ code: "NOT_FOUND", message: error.message })
				}
				throw error
			}
		}),
	})
}
