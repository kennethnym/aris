import { trpcServer } from "@hono/trpc-server"
import { Hono } from "hono"

import { registerAuthHandlers } from "./auth/http.ts"
import { LocationService } from "./location/service.ts"
import { createContext } from "./trpc/context.ts"
import { createTRPCRouter } from "./trpc/router.ts"
import { WeatherService } from "./weather/service.ts"

function main() {
	const locationService = new LocationService()

	const weatherService = new WeatherService({
		credentials: {
			privateKey: process.env.WEATHERKIT_PRIVATE_KEY!,
			keyId: process.env.WEATHERKIT_KEY_ID!,
			teamId: process.env.WEATHERKIT_TEAM_ID!,
			serviceId: process.env.WEATHERKIT_SERVICE_ID!,
		},
	})

	const trpcRouter = createTRPCRouter({ locationService, weatherService })

	const app = new Hono()

	app.get("/health", (c) => c.json({ status: "ok" }))

	registerAuthHandlers(app)

	app.use(
		"/trpc/*",
		trpcServer({
			router: trpcRouter,
			createContext,
		}),
	)

	return app
}

const app = main()

export default {
	port: 3000,
	fetch: app.fetch,
}
