// Context
export type { Context, ContextKey } from "./context"
export { contextKey, contextValue } from "./context"

// Actions
export type { ActionDefinition } from "./action"
export { UnknownActionError } from "./action"

// Feed
export type { FeedItem } from "./feed"

// Feed Source
export type { FeedSource } from "./feed-source"

// Feed Engine
export type { FeedResult, FeedSubscriber, SourceError } from "./feed-engine"
export { FeedEngine } from "./feed-engine"

// =============================================================================
// DEPRECATED - Use FeedSource + FeedEngine instead
// =============================================================================

// Data Source (deprecated - use FeedSource)
export type { DataSource } from "./data-source"

// Context Provider (deprecated - use FeedSource)
export type { ContextProvider } from "./context-provider"

// Context Bridge (deprecated - use FeedEngine)
export type { ProviderError, RefreshResult } from "./context-bridge"
export { ContextBridge } from "./context-bridge"

// Reconciler (deprecated - use FeedEngine)
export type {
	ReconcileResult,
	ReconcilerConfig,
	SourceError as ReconcilerSourceError,
} from "./reconciler"
export { Reconciler } from "./reconciler"

// Feed Controller (deprecated - use FeedEngine)
export type {
	FeedControllerConfig,
	FeedSubscriber as FeedControllerSubscriber,
} from "./feed-controller"
export { FeedController } from "./feed-controller"
