import { trpcServer } from "@hono/trpc-server"
import { Hono } from "hono"

import { registerAuthHandlers } from "./auth/http.ts"
import { createContext } from "./trpc/context.ts"
import { appRouter } from "./trpc/router.ts"

const app = new Hono()

app.get("/health", (c) => c.json({ status: "ok" }))

registerAuthHandlers(app)

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext,
	}),
)

export default {
	port: 3000,
	fetch: app.fetch,
}
