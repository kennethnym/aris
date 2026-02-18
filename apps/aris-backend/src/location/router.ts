import { type } from "arktype"

import type { UserSessionManager } from "../session/index.ts"
import type { TRPC } from "../trpc/router.ts"

const locationInput = type({
	lat: "number",
	lng: "number",
	accuracy: "number",
	timestamp: "Date",
})

export function createLocationRouter(
	t: TRPC,
	{ sessionManager }: { sessionManager: UserSessionManager },
) {
	return t.router({
		update: t.procedure.input(locationInput).mutation(async ({ input, ctx }) => {
			const session = sessionManager.getOrCreate(ctx.user.id)
			await session.engine.executeAction("aris.location", "update-location", {
				lat: input.lat,
				lng: input.lng,
				accuracy: input.accuracy,
				timestamp: input.timestamp,
			})
		}),
	})
}
