# AI Coach Summary

The amber "AI Coach Summary" card on each expanded client row generates LLM-written progress messages the coach can edit, expand with personal observations, and email straight to the client.

Lives in `src/components/clients/AISummary.jsx`. Receives `client` and `details` from `ClientDetails.jsx`. Calls `bsa-chatbot`'s `/api/embed-chat` endpoint (which proxies through to Claude with the configured coach voice).

---

## Two report types

### Weekly Summary (orange button)

Warm, encouraging, motivational. **Uses last-7-day numbers only — not cumulative program completion.**

Data passed to the LLM:
- `workouts_this_week` (count of sessions in the last 7 days)
- `days_per_week` (program design)
- `tonnage_this_week`, `calories_this_week`, `cardio_min_this_week` (rolled up from session-level `volume_stats`)
- A condensed list of this week's sessions with date / day / per-session tonnage / calories / chatbot notes
- Cumulative program data (program name, current week, lifetime workouts, lifetime tonnage) — given as **background context only**, with explicit instruction NOT to lead with it

Tone rules baked into the weekly prompt (these override the model's defaults):
- ALWAYS lead with what they did right. Even one workout this week is a win — name it.
- NEVER use the words *miss / rough / failure / big problem / we need to talk*.
- Low or zero week → frame as "life happens, let's get back at it" with hope and a small concrete next step. NOT discipline.
- Do NOT cite cumulative program completion %. That belongs in the monthly report.
- Output is 3-5 sentences. Address by first name. Sign off as the coach on a new line.

### Monthly Report (purple button)

More clinical. Includes the BY THE NUMBERS section and a FOCUS NEXT MONTH paragraph.

Sections expected:
1. Short opening paragraph (2-3 sentences) framing the month
2. **BY THE NUMBERS** — each metric on its own line: tonnage, calories burned, workouts completed, cardio minutes, completion %
3. **WINS** — notable progress
4. **FOCUS NEXT MONTH** — 2-3 things to dial in. Constructive — direction, not discipline.
5. Sign off as the coach

Uses cumulative numbers (this is where 14/32 lives, not the weekly).

---

## Why the weekly tone fix mattered

The original weekly prompt said "Warm, direct, motivational. Call out a specific win, point to ONE thing to focus on next week, end with energy." The LLM took *direct* too far: for a 14/32 cumulative completion case, it produced "Tanner — rough week, brother. 14 of 32 workouts is a big miss…"

Two root causes:
1. **Wrong data window**: weekly was using cumulative program numbers, so a slow first week of an 8-week program looked just as bad as a slow week 8.
2. **Permissive tone**: "direct" without a banned-words list lets the model pattern-match on standard "honest coach feedback" prose, which veers into shame.

Both fixed. The cumulative % only appears in the monthly now; weekly only sees this-week numbers + soft tone rules.

---

## Expand with my notes

Below the generated summary + Email/Copy/Regenerate row, there's an emerald box:

> **Add your own observations to expand the summary**
> *The data only tells part of the story. Drop in anything <FirstName> told you, what you saw in person, nutrition / sleep / mood / life stuff — Coach Glen rewrites the message to weave it in with concrete advice.*
>
> [textarea — placeholder: e.g. "Jack says they're eating great M-F but binging junk Sat/Sun and feeling stuck on weight. Sleep has been 5-6 hrs."]
>
> [✨ Expand summary with my notes]

When clicked, the LLM receives the **current summary draft** + the **coach's notes** and is told to rewrite the message naturally weaving the observations in with **specific, concrete advice** — not generic "eat better" platitudes.

Tone profile is preserved on the rewrite:
- Weekly: stays warm and encouraging
- Monthly: stays clinical, keeps the BY THE NUMBERS section if present

After a successful expand, the notes input clears (observations are now baked into the summary). The coach can run multiple rounds of expansion if they have more findings to layer in.

The expand prompt explicitly tells the model:
- Reference the observations directly so the client knows the coach has been paying attention to the bigger picture
- Give actionable, concrete advice — if they ate garbage on the weekend, say what to swap or how to plan; if they're not sleeping, name the change
- Keep the workout-data parts of the original; the message can grow longer to accommodate

---

## Voice (per-coach white-label)

The summary speaks in the coach's configured voice when one is set. Uses the public read endpoint `GET /api/coaches/chatbot-config/<coach_id>` from `bsa-coach-platform`.

Resolution order for `coachId`:
1. `client.referred_by_id` (preferred — the client's actual coach)
2. `client.coach_id`
3. `window.tdConfig?.coachId` (whatever the dashboard knows about the logged-in coach)
4. Fallback: voice defaults to "Coach Glen"

`coach_config` is forwarded into the `/api/embed-chat` context so the bsa-chatbot's white-label path activates and the message is signed by the right name (Steve, Ashley, etc).

---

## Action buttons

| Button         | Behavior                                                                       |
|----------------|--------------------------------------------------------------------------------|
| 📧 Email to <Name> | Opens a `mailto:` with subject "Your weekly check-in — <Program>" / "Your monthly progress report — <Program>" and the summary as the body |
| Copy           | `navigator.clipboard.writeText(summary)` — silent on failure                   |
| Regenerate     | Re-runs `generate(period)` — fresh LLM call, same period                       |
| ✨ Expand…     | The coach-notes flow described above                                           |

The summary itself sits in a `<textarea>` so the coach can hand-edit before sending.

---

## File map

| File                                               | Purpose                                                                  |
|----------------------------------------------------|--------------------------------------------------------------------------|
| `src/components/clients/AISummary.jsx`             | The whole card — generate, expand, email, copy, regenerate              |
| `src/components/clients/ClientDetails.jsx`         | Hosts the AISummary card alongside charts                                |
