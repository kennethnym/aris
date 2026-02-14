import type { Context } from "./context"
import type { FeedItem } from "./feed"
import type { FeedSource } from "./feed-source"

export interface SourceError {
	sourceId: string
	error: Error
}

export interface FeedResult<TItem extends FeedItem = FeedItem> {
	context: Context
	items: TItem[]
	errors: SourceError[]
}

export type FeedSubscriber<TItem extends FeedItem = FeedItem> = (result: FeedResult<TItem>) => void

interface SourceGraph {
	sources: Map<string, FeedSource>
	sorted: FeedSource[]
	dependents: Map<string, string[]>
}

/**
 * Orchestrates FeedSources, managing the dependency graph and context flow.
 *
 * Sources declare dependencies on other sources. The engine:
 * - Validates the dependency graph (no missing deps, no cycles)
 * - Runs fetchContext() in topological order during refresh
 * - Runs fetchItems() on all sources with accumulated context
 * - Subscribes to reactive updates via onContextUpdate/onItemsUpdate
 *
 * @example
 * ```ts
 * const engine = new FeedEngine()
 *   .register(locationSource)
 *   .register(weatherSource)
 *   .register(alertSource)
 *
 * // Pull-based refresh
 * const { context, items, errors } = await engine.refresh()
 *
 * // Reactive updates
 * engine.subscribe((result) => {
 *   console.log(result.items)
 * })
 * engine.start()
 *
 * // Cleanup
 * engine.stop()
 * ```
 */
export class FeedEngine<TItems extends FeedItem = FeedItem> {
	private sources = new Map<string, FeedSource>()
	private graph: SourceGraph | null = null
	private context: Context = { time: new Date() }
	private subscribers = new Set<FeedSubscriber<TItems>>()
	private cleanups: Array<() => void> = []
	private started = false

	/**
	 * Registers a FeedSource. Invalidates the cached graph.
	 */
	register<TItem extends FeedItem>(source: FeedSource<TItem>): FeedEngine<TItems | TItem> {
		this.sources.set(source.id, source)
		this.graph = null
		return this as FeedEngine<TItems | TItem>
	}

	/**
	 * Unregisters a FeedSource by ID. Invalidates the cached graph.
	 */
	unregister(sourceId: string): this {
		this.sources.delete(sourceId)
		this.graph = null
		return this
	}

	/**
	 * Refreshes the feed by running all sources in dependency order.
	 * Calls fetchContext() then fetchItems() on each source.
	 */
	async refresh(): Promise<FeedResult<TItems>> {
		const graph = this.ensureGraph()
		const errors: SourceError[] = []

		// Reset context with fresh time
		let context: Context = { time: new Date() }

		// Run fetchContext in topological order
		for (const source of graph.sorted) {
			try {
				const update = await source.fetchContext(context)
				if (update) {
					context = { ...context, ...update }
				}
			} catch (err) {
				errors.push({
					sourceId: source.id,
					error: err instanceof Error ? err : new Error(String(err)),
				})
			}
		}

		// Run fetchItems on all sources
		const items: FeedItem[] = []
		for (const source of graph.sorted) {
			if (source.fetchItems) {
				try {
					const sourceItems = await source.fetchItems(context)
					items.push(...sourceItems)
				} catch (err) {
					errors.push({
						sourceId: source.id,
						error: err instanceof Error ? err : new Error(String(err)),
					})
				}
			}
		}

		// Sort by priority descending
		items.sort((a, b) => b.priority - a.priority)

		this.context = context

		return { context, items: items as TItems[], errors }
	}

	/**
	 * Subscribes to feed updates. Returns unsubscribe function.
	 */
	subscribe(callback: FeedSubscriber<TItems>): () => void {
		this.subscribers.add(callback)
		return () => {
			this.subscribers.delete(callback)
		}
	}

	/**
	 * Starts reactive subscriptions on all sources.
	 * Sources with onContextUpdate will trigger re-computation of dependents.
	 */
	start(): void {
		if (this.started) return

		this.started = true
		const graph = this.ensureGraph()

		for (const source of graph.sorted) {
			if (source.onContextUpdate) {
				const cleanup = source.onContextUpdate(
					(update) => {
						this.handleContextUpdate(source.id, update)
					},
					() => this.context,
				)
				this.cleanups.push(cleanup)
			}

			if (source.onItemsUpdate) {
				const cleanup = source.onItemsUpdate(
					() => {
						this.scheduleRefresh()
					},
					() => this.context,
				)
				this.cleanups.push(cleanup)
			}
		}
	}

	/**
	 * Stops all reactive subscriptions.
	 */
	stop(): void {
		this.started = false
		for (const cleanup of this.cleanups) {
			cleanup()
		}
		this.cleanups = []
	}

	/**
	 * Returns the current accumulated context.
	 */
	currentContext(): Context {
		return this.context
	}

	private ensureGraph(): SourceGraph {
		if (!this.graph) {
			this.graph = buildGraph(Array.from(this.sources.values()))
		}
		return this.graph
	}

	private handleContextUpdate(sourceId: string, update: Partial<Context>): void {
		this.context = { ...this.context, ...update, time: new Date() }

		// Re-run dependents and notify
		this.refreshDependents(sourceId)
	}

	private async refreshDependents(sourceId: string): Promise<void> {
		const graph = this.ensureGraph()
		const toRefresh = this.collectDependents(sourceId, graph)

		// Re-run fetchContext for dependents in order
		for (const id of toRefresh) {
			const source = graph.sources.get(id)
			if (source) {
				try {
					const update = await source.fetchContext(this.context)
					if (update) {
						this.context = { ...this.context, ...update }
					}
				} catch {
					// Errors during reactive updates are logged but don't stop propagation
				}
			}
		}

		// Collect items from all sources
		const items: FeedItem[] = []
		const errors: SourceError[] = []

		for (const source of graph.sorted) {
			if (source.fetchItems) {
				try {
					const sourceItems = await source.fetchItems(this.context)
					items.push(...sourceItems)
				} catch (err) {
					errors.push({
						sourceId: source.id,
						error: err instanceof Error ? err : new Error(String(err)),
					})
				}
			}
		}

		items.sort((a, b) => b.priority - a.priority)

		this.notifySubscribers({ context: this.context, items: items as TItems[], errors })
	}

	private collectDependents(sourceId: string, graph: SourceGraph): string[] {
		const result: string[] = []
		const visited = new Set<string>()

		const collect = (id: string): void => {
			const deps = graph.dependents.get(id) ?? []
			for (const dep of deps) {
				if (!visited.has(dep)) {
					visited.add(dep)
					result.push(dep)
					collect(dep)
				}
			}
		}

		collect(sourceId)

		// Return in topological order
		return graph.sorted.filter((s) => result.includes(s.id)).map((s) => s.id)
	}

	private scheduleRefresh(): void {
		// Simple immediate refresh for now - could add debouncing later
		this.refresh().then((result) => {
			this.notifySubscribers(result)
		})
	}

	private notifySubscribers(result: FeedResult<TItems>): void {
		this.subscribers.forEach((callback) => {
			try {
				callback(result)
			} catch {
				// Subscriber errors shouldn't break other subscribers
			}
		})
	}
}

function buildGraph(sources: FeedSource[]): SourceGraph {
	const byId = new Map<string, FeedSource>()
	for (const source of sources) {
		byId.set(source.id, source)
	}

	// Validate dependencies exist
	for (const source of sources) {
		for (const dep of source.dependencies ?? []) {
			if (!byId.has(dep)) {
				throw new Error(`Source "${source.id}" depends on "${dep}" which is not registered`)
			}
		}
	}

	// Check for cycles and topologically sort
	const visited = new Set<string>()
	const visiting = new Set<string>()
	const sorted: FeedSource[] = []

	function visit(id: string, path: string[]): void {
		if (visiting.has(id)) {
			const cycle = [...path.slice(path.indexOf(id)), id].join(" → ")
			throw new Error(`Circular dependency detected: ${cycle}`)
		}
		if (visited.has(id)) return

		visiting.add(id)
		const source = byId.get(id)!
		for (const dep of source.dependencies ?? []) {
			visit(dep, [...path, id])
		}
		visiting.delete(id)
		visited.add(id)
		sorted.push(source)
	}

	for (const source of sources) {
		visit(source.id, [])
	}

	// Build reverse dependency map
	const dependents = new Map<string, string[]>()
	for (const source of sources) {
		for (const dep of source.dependencies ?? []) {
			const list = dependents.get(dep) ?? []
			list.push(source.id)
			dependents.set(dep, list)
		}
	}

	return { sources: byId, sorted, dependents }
}
