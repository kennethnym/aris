import { LocationSource } from "@aris/source-location"
import { trpcServer } from "@hono/trpc-server"
import { Hono } from "hono"

import { registerAuthHandlers } from "./auth/http.ts"
import { UserSessionManager } from "./session/index.ts"
import { WeatherSourceProvider } from "./weather/provider.ts"
import { createContext } from "./trpc/context.ts"
import { createTRPCRouter } from "./trpc/router.ts"

function main() {
	const sessionManager = new UserSessionManager([
		() => new LocationSource(),
		new WeatherSourceProvider({
			credentials: {
				privateKey: process.env.WEATHERKIT_PRIVATE_KEY!,
				keyId: process.env.WEATHERKIT_KEY_ID!,
				teamId: process.env.WEATHERKIT_TEAM_ID!,
				serviceId: process.env.WEATHERKIT_SERVICE_ID!,
			},
		}),
	])

	const trpcRouter = createTRPCRouter({ sessionManager })

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
