export interface FeedItem<
	TType extends string = string,
	TData extends Record<string, unknown> = Record<string, unknown>,
> {
	id: string
	type: TType
	priority: number
	timestamp: Date
	data: TData
}
