import { Hono } from "hono"

import { registerAuthHandlers } from "./auth/http.ts"

const app = new Hono()

app.get("/health", (c) => c.json({ status: "ok" }))

registerAuthHandlers(app)

export default {
	port: 3000,
	fetch: app.fetch,
}
