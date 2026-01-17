# React Best Practices

**Version 1.0.0**

> **Note:**
> This document is for agents and LLMs to follow when maintaining,
> generating, or refactoring React codebases. Humans may also find it useful.

---

## Abstract

Performance optimization guide for React applications, designed for AI agents and LLMs. Contains rules across 7 categories, prioritized by impact from critical (eliminating waterfalls, reducing bundle size) to incremental (advanced patterns).

---

## Table of Contents

1. [Eliminating Waterfalls](#1-eliminating-waterfalls) — **CRITICAL**
2. [Bundle Size Optimization](#2-bundle-size-optimization) — **CRITICAL**
3. [Client-Side Data Fetching](#3-client-side-data-fetching) — **MEDIUM-HIGH**
4. [Re-render Optimization](#4-re-render-optimization) — **MEDIUM**
5. [Rendering Performance](#5-rendering-performance) — **MEDIUM**
6. [JavaScript Performance](#6-javascript-performance) — **LOW-MEDIUM**
7. [Advanced Patterns](#7-advanced-patterns) — **LOW**

---

## 1. Eliminating Waterfalls

**Impact: CRITICAL**

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### 1.1 Defer Await Until Needed

**Impact: HIGH (avoids blocking unused code paths)**

Move `await` operations into the branches where they're actually used.

**Incorrect: blocks both branches**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  
  if (skipProcessing) {
    return { skipped: true }
  }
  
  return processUserData(userData)
}
```

**Correct: only blocks when needed**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true }
  }
  
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### 1.2 Dependency-Based Parallelization

**Impact: CRITICAL (2-10× improvement)**

For operations with partial dependencies, use `better-all` to maximize parallelism.

**Incorrect: profile waits for config unnecessarily**

```typescript
const [user, config] = await Promise.all([
  fetchUser(),
  fetchConfig()
])
const profile = await fetchProfile(user.id)
```

**Correct: config and profile run in parallel**

```typescript
import { all } from 'better-all'

const { user, config, profile } = await all({
  async user() { return fetchUser() },
  async config() { return fetchConfig() },
  async profile() {
    return fetchProfile((await this.$.user).id)
  }
})
```

### 1.3 Promise.all() for Independent Operations

**Impact: CRITICAL (2-10× improvement)**

When async operations have no interdependencies, execute them concurrently.

**Incorrect: sequential execution, 3 round trips**

```typescript
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()
```

**Correct: parallel execution, 1 round trip**

```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

---

## 2. Bundle Size Optimization

**Impact: CRITICAL**

Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.

### 2.1 Avoid Barrel File Imports

**Impact: CRITICAL (200-800ms import cost, slow builds)**

Import directly from source files instead of barrel files.

**Incorrect: imports entire library**

```tsx
import { Check, X, Menu } from 'lucide-react'
// Loads 1,583 modules
```

**Correct: imports only what you need**

```tsx
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
// Loads only 3 modules
```

Libraries commonly affected: `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@headlessui/react`, `@radix-ui/react-*`, `lodash`, `ramda`, `date-fns`, `rxjs`, `react-use`.

### 2.2 Conditional Module Loading

**Impact: HIGH (loads large data only when needed)**

Load large data or modules only when a feature is activated.

```tsx
function AnimationPlayer({ enabled, setEnabled }) {
  const [frames, setFrames] = useState(null)

  useEffect(() => {
    if (enabled && !frames) {
      import('./animation-frames.js')
        .then(mod => setFrames(mod.frames))
        .catch(() => setEnabled(false))
    }
  }, [enabled, frames, setEnabled])

  if (!frames) return <Skeleton />
  return <Canvas frames={frames} />
}
```

### 2.3 Preload Based on User Intent

**Impact: MEDIUM (reduces perceived latency)**

Preload heavy bundles before they're needed.

```tsx
function EditorButton({ onClick }) {
  const preload = () => {
    void import('./monaco-editor')
  }

  return (
    <button
      onMouseEnter={preload}
      onFocus={preload}
      onClick={onClick}
    >
      Open Editor
    </button>
  )
}
```

---

## 3. Client-Side Data Fetching

**Impact: MEDIUM-HIGH**

### 3.1 Deduplicate Global Event Listeners

**Impact: MEDIUM (prevents memory leaks and duplicate handlers)**

Use a singleton pattern for global event listeners.

**Incorrect: multiple listeners**

```tsx
function useWindowResize(callback) {
  useEffect(() => {
    window.addEventListener('resize', callback)
    return () => window.removeEventListener('resize', callback)
  }, [callback])
}
```

**Correct: shared listener**

```tsx
const listeners = new Set()
let isListening = false

function useWindowResize(callback) {
  useEffect(() => {
    listeners.add(callback)
    
    if (!isListening) {
      isListening = true
      window.addEventListener('resize', (e) => {
        listeners.forEach(fn => fn(e))
      })
    }
    
    return () => listeners.delete(callback)
  }, [callback])
}
```

### 3.2 Use Passive Event Listeners

**Impact: MEDIUM (improves scroll performance)**

Use passive listeners for scroll and touch events.

```tsx
useEffect(() => {
  const handler = (e) => { /* handle scroll */ }
  window.addEventListener('scroll', handler, { passive: true })
  return () => window.removeEventListener('scroll', handler)
}, [])
```

### 3.3 Use SWR for Automatic Deduplication

**Impact: HIGH (eliminates duplicate requests)**

SWR automatically deduplicates requests to the same key.

```tsx
import useSWR from 'swr'

function UserProfile({ userId }) {
  const { data } = useSWR(`/api/users/${userId}`, fetcher)
  return <div>{data?.name}</div>
}

// Multiple components using the same key = single request
```

### 3.4 Version and Minimize localStorage Data

**Impact: MEDIUM (prevents data corruption)**

Use schema versioning for localStorage.

```typescript
const STORAGE_VERSION = 2

interface StoredData {
  version: number
  data: UserPreferences
}

function loadPreferences(): UserPreferences {
  const raw = localStorage.getItem('prefs')
  if (!raw) return defaultPreferences
  
  const stored: StoredData = JSON.parse(raw)
  if (stored.version !== STORAGE_VERSION) {
    return migrate(stored)
  }
  return stored.data
}
```

---

## 4. Re-render Optimization

**Impact: MEDIUM**

### 4.1 Defer State Reads to Usage Point

**Impact: MEDIUM (avoids unnecessary re-renders)**

Don't subscribe to state that's only used in callbacks.

**Incorrect: re-renders on every count change**

```tsx
function Counter() {
  const count = useStore(state => state.count)
  const increment = useStore(state => state.increment)
  
  return <button onClick={() => increment()}>+</button>
}
```

**Correct: no re-renders from count changes**

```tsx
function Counter() {
  const increment = useStore(state => state.increment)
  
  return <button onClick={() => increment()}>+</button>
}
```

### 4.2 Extract to Memoized Components

**Impact: MEDIUM (isolates expensive renders)**

Extract expensive computations into memoized child components.

```tsx
const ExpensiveList = memo(function ExpensiveList({ items }) {
  return items.map(item => <ExpensiveItem key={item.id} item={item} />)
})

function Parent() {
  const [filter, setFilter] = useState('')
  const items = useItems()
  
  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <ExpensiveList items={items} />
    </>
  )
}
```

### 4.3 Narrow Effect Dependencies

**Impact: MEDIUM (reduces effect runs)**

Use primitive dependencies instead of objects.

**Incorrect: runs on every render**

```tsx
useEffect(() => {
  fetchData(options)
}, [options]) // Object reference changes every render
```

**Correct: runs only when values change**

```tsx
useEffect(() => {
  fetchData({ page, limit })
}, [page, limit])
```

### 4.4 Subscribe to Derived State

**Impact: MEDIUM (reduces re-renders)**

Subscribe to derived booleans instead of raw values.

**Incorrect: re-renders on every count change**

```tsx
function Badge() {
  const count = useStore(state => state.notifications.length)
  return count > 0 ? <span>New</span> : null
}
```

**Correct: re-renders only when visibility changes**

```tsx
function Badge() {
  const hasNotifications = useStore(state => state.notifications.length > 0)
  return hasNotifications ? <span>New</span> : null
}
```

### 4.5 Use Functional setState Updates

**Impact: MEDIUM (stable callback references)**

Use functional updates to avoid dependency on current state.

```tsx
// Incorrect: callback changes when count changes
const increment = useCallback(() => {
  setCount(count + 1)
}, [count])

// Correct: stable callback reference
const increment = useCallback(() => {
  setCount(c => c + 1)
}, [])
```

### 4.6 Use Lazy State Initialization

**Impact: LOW-MEDIUM (avoids expensive initial computation)**

Pass a function to useState for expensive initial values.

```tsx
// Incorrect: parses on every render
const [data, setData] = useState(JSON.parse(localStorage.getItem('data')))

// Correct: parses only once
const [data, setData] = useState(() => JSON.parse(localStorage.getItem('data')))
```

### 4.7 Use Transitions for Non-Urgent Updates

**Impact: MEDIUM (keeps UI responsive)**

Use startTransition for updates that can be deferred.

```tsx
import { startTransition } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  
  const handleChange = (e) => {
    setQuery(e.target.value) // Urgent: update input immediately
    
    startTransition(() => {
      setResults(search(e.target.value)) // Non-urgent: can be interrupted
    })
  }
  
  return (
    <>
      <input value={query} onChange={handleChange} />
      <ResultsList results={results} />
    </>
  )
}
```

---

## 5. Rendering Performance

**Impact: MEDIUM**

### 5.1 Animate SVG Wrapper Instead of SVG Element

**Impact: MEDIUM (avoids SVG re-parsing)**

Wrap SVGs in a div and animate the wrapper.

```tsx
// Incorrect: triggers SVG re-parsing
<motion.svg animate={{ scale: 1.2 }}>...</motion.svg>

// Correct: animates wrapper only
<motion.div animate={{ scale: 1.2 }}>
  <svg>...</svg>
</motion.div>
```

### 5.2 CSS content-visibility for Long Lists

**Impact: HIGH (skips off-screen rendering)**

Use content-visibility to skip rendering off-screen items.

```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 50px;
}
```

### 5.3 Hoist Static JSX Elements

**Impact: LOW-MEDIUM (avoids recreation)**

Extract static JSX outside components.

```tsx
const staticIcon = <Icon name="check" />

function ListItem({ label }) {
  return (
    <div>
      {staticIcon}
      <span>{label}</span>
    </div>
  )
}
```

### 5.4 Optimize SVG Precision

**Impact: LOW (reduces SVG size)**

Reduce coordinate precision in SVGs.

```tsx
// Before: 847 bytes
<path d="M12.7071067811865 5.29289321881345..." />

// After: 324 bytes
<path d="M12.71 5.29..." />
```

### 5.5 Use Explicit Conditional Rendering

**Impact: LOW (prevents rendering bugs)**

Use ternary instead of && for conditionals.

```tsx
// Incorrect: renders "0" when count is 0
{count && <Badge count={count} />}

// Correct: renders nothing when count is 0
{count > 0 ? <Badge count={count} /> : null}
```

---

## 6. JavaScript Performance

**Impact: LOW-MEDIUM**

### 6.1 Batch DOM CSS Changes

**Impact: MEDIUM (reduces reflows)**

Group CSS changes via classes or cssText.

```typescript
// Incorrect: 3 reflows
element.style.width = '100px'
element.style.height = '100px'
element.style.margin = '10px'

// Correct: 1 reflow
element.style.cssText = 'width: 100px; height: 100px; margin: 10px;'
```

### 6.2 Build Index Maps for Repeated Lookups

**Impact: HIGH for large datasets**

Build a Map for O(1) lookups instead of O(n) array searches.

```typescript
// Incorrect: O(n) for each lookup
users.find(u => u.id === targetId)

// Correct: O(1) lookup
const userMap = new Map(users.map(u => [u.id, u]))
userMap.get(targetId)
```

### 6.3 Cache Property Access in Loops

**Impact: LOW-MEDIUM**

Cache object properties accessed in loops.

```typescript
// Incorrect
for (let i = 0; i < items.length; i++) {
  process(items[i])
}

// Correct
const len = items.length
for (let i = 0; i < len; i++) {
  process(items[i])
}
```

### 6.4 Cache Repeated Function Calls

**Impact: MEDIUM**

Cache expensive function results.

```typescript
const cache = new Map()

function expensiveComputation(input) {
  if (cache.has(input)) return cache.get(input)
  const result = /* expensive work */
  cache.set(input, result)
  return result
}
```

### 6.5 Cache Storage API Calls

**Impact: MEDIUM**

Cache localStorage/sessionStorage reads.

```typescript
let cachedTheme = null

function getTheme() {
  if (cachedTheme === null) {
    cachedTheme = localStorage.getItem('theme') || 'light'
  }
  return cachedTheme
}
```

### 6.6 Combine Multiple Array Iterations

**Impact: LOW-MEDIUM**

Combine filter/map into a single loop.

```typescript
// Incorrect: 2 iterations
const result = items
  .filter(item => item.active)
  .map(item => item.value)

// Correct: 1 iteration
const result = []
for (const item of items) {
  if (item.active) result.push(item.value)
}
```

### 6.7 Early Length Check for Array Comparisons

**Impact: LOW**

Check array length before expensive comparisons.

```typescript
function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  return a.every((val, i) => val === b[i])
}
```

### 6.8 Early Return from Functions

**Impact: LOW**

Return early to avoid unnecessary work.

```typescript
function processUser(user) {
  if (!user) return null
  if (!user.active) return null
  
  // Process active user
}
```

### 6.9 Hoist RegExp Creation

**Impact: LOW-MEDIUM**

Create RegExp outside loops.

```typescript
// Incorrect: creates regex on each iteration
items.forEach(item => {
  if (/pattern/.test(item)) { /* ... */ }
})

// Correct: reuses regex
const pattern = /pattern/
items.forEach(item => {
  if (pattern.test(item)) { /* ... */ }
})
```

### 6.10 Use Loop for Min/Max Instead of Sort

**Impact: MEDIUM for large arrays**

Use a loop instead of sorting to find min/max.

```typescript
// Incorrect: O(n log n)
const max = items.sort((a, b) => b - a)[0]

// Correct: O(n)
const max = Math.max(...items)
// Or for very large arrays:
let max = items[0]
for (let i = 1; i < items.length; i++) {
  if (items[i] > max) max = items[i]
}
```

### 6.11 Use Set/Map for O(1) Lookups

**Impact: HIGH for repeated lookups**

Use Set for membership checks, Map for key-value lookups.

```typescript
// Incorrect: O(n)
const isValid = validIds.includes(id)

// Correct: O(1)
const validIdSet = new Set(validIds)
const isValid = validIdSet.has(id)
```

### 6.12 Use toSorted() for Immutability

**Impact: LOW**

Use toSorted() instead of sort() to avoid mutation.

```typescript
// Mutates original
const sorted = items.sort((a, b) => a - b)

// Returns new array
const sorted = items.toSorted((a, b) => a - b)
```

---

## 7. Advanced Patterns

**Impact: LOW**

### 7.1 Store Event Handlers in Refs

**Impact: LOW (avoids effect re-runs)**

Store handlers in refs to avoid effect dependencies.

```tsx
function useEventListener(event, handler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  
  useEffect(() => {
    const listener = (e) => handlerRef.current(e)
    window.addEventListener(event, listener)
    return () => window.removeEventListener(event, listener)
  }, [event]) // handler not in deps
}
```

### 7.2 useLatest for Stable Callback Refs

**Impact: LOW**

Create a useLatest hook for stable references.

```tsx
function useLatest(value) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

function useInterval(callback, delay) {
  const callbackRef = useLatest(callback)
  
  useEffect(() => {
    const id = setInterval(() => callbackRef.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}
```

---

## References

1. [https://github.com/shuding/better-all](https://github.com/shuding/better-all)
2. [https://vercel.com/blog/how-we-optimized-package-imports-in-next-js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
