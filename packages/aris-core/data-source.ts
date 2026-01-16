import type { Context } from "./context"
import type { FeedItem } from "./feed"

export interface DataSource<TItem extends FeedItem = FeedItem, TConfig = unknown> {
	readonly type: TItem["type"]
	query(context: Context, config: TConfig): Promise<TItem[]>
}
