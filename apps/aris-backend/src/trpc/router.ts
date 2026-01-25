import { router } from "./trpc.ts"

export const appRouter = router({})

export type AppRouter = typeof appRouter
