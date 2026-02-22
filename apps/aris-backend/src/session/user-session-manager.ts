import type { FeedSourceProviderInput } from "./feed-source-provider.ts"

import { UserSession } from "./user-session.ts"

export class UserSessionManager {
	private sessions = new Map<string, UserSession>()
	private readonly providers: FeedSourceProviderInput[]

	constructor(providers: FeedSourceProviderInput[]) {
		this.providers = providers
	}

	getOrCreate(userId: string): UserSession {
		let session = this.sessions.get(userId)
		if (!session) {
			const sources = this.providers.map((p) =>
				typeof p === "function" ? p(userId) : p.feedSourceForUser(userId),
			)
			session = new UserSession(sources)
			this.sessions.set(userId, session)
		}
		return session
	}

	remove(userId: string): void {
		const session = this.sessions.get(userId)
		if (session) {
			session.destroy()
			this.sessions.delete(userId)
		}
	}
}
