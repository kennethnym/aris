# AI Agent Ideas for ARIS

> Brainstorm document. Not all ideas are feasible or desirable - just capturing possibilities.

## 1. Feed Curation Agent

Sits between the reconciler and UI. Reranks/filters the raw feed based on learned preferences and context.

**Examples:**

- User always dismisses weather items in the morning → agent deprioritizes them
- User frequently taps calendar items before meetings → agent boosts them 30 minutes prior
- Deduplicates or groups related items ("3 meetings in the next hour")
- Learns time-of-day patterns (work items in morning, personal in evening)

**Interface:**

```typescript
interface FeedAgent {
	process(
		items: FeedItem[],
		context: Context,
		userPreferences: UserPreferences,
	): Promise<FeedItem[]>
}
```

**Fits naturally as a post-processor after reconciliation.**

---

## 2. Query Agent

User asks natural language questions about their feed or connected data.

**Examples:**

- "What's on my calendar tomorrow?"
- "When's my next flight?"
- "Summarize my day"
- "Do I have any conflicts this week?"
- "What did I have scheduled last Tuesday?"

**Behavior:**

- Agent queries relevant sources directly or searches recent feed history
- Synthesizes data into conversational response
- Could generate a temporary filtered feed view

---

## 3. Proactive Agent

Monitors context changes and triggers actions without user prompting.

**Examples:**

- Near grocery store + "buy milk" in tasks → surfaces reminder
- Calendar conflict detected → alerts before it happens
- Weather changing → suggests leaving earlier for commute
- Unusual traffic on commute route → notifies user
- Meeting in 10 minutes but user hasn't moved → gentle nudge
- Package delivered + user is home → notification

**Implementation considerations:**

- Needs background processing / push capability
- Privacy implications of continuous monitoring
- Battery/resource usage on mobile

---

## 4. Source Configuration Agent

Helps users set up and tune sources through conversation.

**Examples:**

- "Show me fewer emails"
- "Only show calendar events for work"
- "I don't care about weather"
- "Prioritize tasks over calendar"
- "Add my Spotify account"

**Behavior:**

- Translates natural language into source config changes
- Can explain what each source does
- Helps troubleshoot when sources aren't working

---

## 5. Feed Item Generation Agent (AI-Native Sources)

Some sources are AI-powered rather than API-driven.

**Examples:**

- Daily briefing: "You have 4 meetings today, busiest is 2-4pm"
- Pattern-based reminders: "You usually go to the gym on Tuesdays"
- Suggested actions: "You haven't responded to Sarah's email from yesterday"
- Weekly review: "You completed 12 tasks this week, 3 are overdue"
- Context synthesis: "Your flight lands at 3pm, you have a meeting at 5pm - that's tight"

**These are sources that implement `DataSource` but use an LLM internally.**

---

## 6. Action Agent

Executes actions on behalf of the user based on feed items.

**Examples:**

- "Snooze this reminder for 1 hour"
- "RSVP yes to this event"
- "Mark this task as done"
- "Send a quick reply saying I'll be late"
- "Book an Uber to this location"

**Considerations:**

- Needs action capabilities per source
- Confirmation UX for destructive/costly actions
- OAuth scopes for write access

---

## 7. Explanation Agent

Explains why items appear in the feed.

**Examples:**

- User asks "Why am I seeing this?"
- Agent explains: "This calendar event starts in 15 minutes and you marked it as important"
- Helps users understand and trust the system
- Useful for debugging source behavior

---

## 8. Cross-Source Reasoning Agent

Connects information across multiple sources to surface insights.

**Examples:**

- Calendar shows dinner reservation + weather source shows rain → "Bring an umbrella to dinner"
- Flight delayed + calendar has meeting after landing → "Your 3pm meeting may be affected by flight delay"
- Task "buy birthday gift" + calendar shows birthday party tomorrow → boosts task priority
- Email mentions address + maps knows traffic → "Leave by 2pm to make your 3pm appointment"

**This is more complex - requires understanding relationships between items.**

---

## 9. Memory Agent

Maintains long-term memory of user interactions and preferences.

**Examples:**

- Remembers user dismissed a recurring item 5 times → stops showing it
- Knows user's home/work locations from patterns
- Tracks what times user typically checks the feed
- Remembers user's stated preferences from conversations
- Builds implicit preference model over time

**Feeds into other agents (especially Feed Curation).**

---

## 10. Onboarding Agent

Guides new users through setup conversationally.

**Examples:**

- "What apps do you use for calendar?"
- "Would you like to see weather in your feed?"
- "What's most important to you - tasks, calendar, or communications?"
- Progressively enables sources based on conversation
- Explains privacy implications of each source

---

## 11. Anomaly Detection Agent

Surfaces unusual patterns or items that break routine.

**Examples:**

- "You have a meeting at 6am tomorrow - that's unusual for you"
- "This is your first free afternoon in 2 weeks"
- "You haven't completed any tasks in 3 days"
- "Your calendar is empty tomorrow - did you mean to block time?"

---

## 12. Delegation Agent

Handles tasks the user delegates via natural language.

**Examples:**

- "Remind me about this tomorrow"
- "Schedule a meeting with John next week"
- "Add milk to my shopping list"
- "Find a time that works for both me and Sarah"

**Requires write access to various sources.**

---

## 13. Summary Agent

Generates periodic summaries of feed activity.

**Examples:**

- Morning briefing: "Here's your day ahead"
- Evening recap: "Here's what happened today"
- Weekly digest: "This week you had 12 meetings, completed 8 tasks"
- Travel summary: "Your trip to NYC: 3 flights, 2 hotels, 5 meetings"

**Could be a scheduled AI-native source.**

---

## 14. Notification Agent

Decides what deserves a push notification vs. passive feed presence.

**Examples:**

- High-priority items get pushed
- Learns what user actually responds to
- Batches low-priority items into digest notifications
- Respects focus modes / do-not-disturb

**Reduces notification fatigue while ensuring important items aren't missed.**

---

## 15. Conversation Agent

General-purpose assistant that can discuss feed items.

**Examples:**

- User taps an item and asks "Tell me more about this"
- "What should I prepare for this meeting?"
- "What's the best route to this location?"
- "Who else is attending this event?"

**Contextual conversation anchored to specific feed items.**

---

## Implementation Priority Suggestion

If implementing incrementally:

1. **Feed Curation Agent** - highest value, fits existing architecture
2. **Query Agent** - natural user expectation for AI assistant
3. **Summary Agent** - low risk, high perceived value
4. **Proactive Agent** - differentiator, but complex
5. **Cross-Source Reasoning** - advanced, builds on others

---

## Open Questions

- Where do agents run? (Client, server, edge?)
- How to handle agent latency in feed rendering?
- Privacy model for agent memory/learning?
- How do agents interact with third-party sources?
- Cost management for LLM calls?
