# AI / LLM Integration Security

## API Keys Must Be Server-Only

Meridian uses three AI providers:
- `ANTHROPIC_API_KEY` — Claude (optional, wenn INTERVIEW_MODEL auf anthropic/ gesetzt)
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini (Standard-Provider für alle LLM-Calls)
- `JINA_API_KEY` — jina-embeddings-v3 (knowledge extraction, PROJ-14)

None of these may appear with `NEXT_PUBLIC_` prefix. None may be imported in Client Components. All AI calls go through API routes or services in `src/services/`.

Check: if `process.env.ANTHROPIC_API_KEY` (or the others) appears in any file under `src/app/` that isn't a route handler or server component, that's a leak.

## Spending Caps (Manual — Do This Now)

Code-level rate limiting isn't enough if you forget to set caps at the provider level.

- **Anthropic:** Settings → Limits → Monthly budget
- **Google AI Studio:** Quotas & System Limits in Cloud Console
- **OpenAI:** Settings → Limits → Usage limits

A cap that breaks your app temporarily beats a $10,000 surprise invoice.

## Prompt Injection

The interview agent takes `user_input` from an HTTP request body and passes it to the LLM as the user message. The current architecture already separates system prompt from user content (messages array), which is the correct approach.

**Do not** concatenate user input into the system prompt string:
```typescript
// BAD
const systemPrompt = `You are an interviewer. The user said: ${userInput}. Now...`

// GOOD — already how Meridian works
messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userInput },
]
```

Sophisticated injection can still occur across message boundaries. For Meridian's use case (interview agent, not a tool-calling agent with DB write access), the blast radius is low — an attacker can confuse the interview but cannot write to the database via prompt injection alone.

## LLM Output Rendering

If agent responses are rendered as HTML or with a markdown renderer that allows arbitrary HTML:
- Sanitize output before rendering (`DOMPurify` or `rehype-sanitize`)
- Never use `dangerouslySetInnerHTML` with unsanitized LLM output

## Tool / Function Calling

If the interview agent is extended with tool access (database reads/writes, external API calls), apply least-privilege:
- Read-only access where possible
- Validate all tool call parameters against a schema before executing
- Log all tool invocations
- Never let the LLM construct raw SQL from user input
