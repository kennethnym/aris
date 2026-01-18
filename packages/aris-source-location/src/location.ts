import type { ContextKey } from "@aris/core"

import { contextKey } from "@aris/core"

export interface Location {
	lat: number
	lng: number
	accuracy: number
}

export const LocationKey: ContextKey<Location> = contextKey("location")
