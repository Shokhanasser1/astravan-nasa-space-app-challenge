---
name: ux-heuristics
description: Usability evaluation using Nielsen's 10 heuristics plus supporting laws (Fitts, Hick, Miller, Jakob) and a severity-rated audit protocol. Use when reviewing a UI/flow for usability problems, doing a UX audit, or sanity-checking a design before shipping. In HOME BY SEVEN: required before the G4 freeze on the day screen and the truth screen; judge against .claude/rules/ui.md (children 7-14, 360x640, three languages).
---

# UX Heuristics — usability evaluation protocol

Use for auditing screens/flows. Output findings as: **[Severity 1–4] Heuristic # — problem — where — recommendation.**
Severity: 1 = cosmetic, 2 = minor (annoys), 3 = major (hinders task), 4 = blocker (prevents task / data loss).

## Nielsen's 10 heuristics — what to actually check

1. **Visibility of system status.** Every action gets feedback within 100ms (instant), spinner past 1s, progress + time estimate past 10s. Check: saving states, upload progress, background jobs, optimistic UI reconciliation, "last synced" indicators.
2. **Match between system and real world.** Words are the user's, not the schema's ("Remove from cart", not "Delete line_item"). Information appears in natural order. Icons match real-world referents. Dates/currency/units localized.
3. **User control and freedom.** Undo beats confirm-dialogs. Every wizard has Back without data loss. Modals close via Esc/overlay/X. Destructive actions reversible (soft delete, 30-day trash) or double-confirmed with the consequence named ("Delete 3 projects?" not "Are you sure?").
4. **Consistency and standards.** Internal: one term per concept, one pattern per action across screens. External (Jakob's Law): users spend most time on OTHER sites — logo→home, cart top-right, search with magnifier, links look like links. Deviate only with a reason.
5. **Error prevention.** Constrain instead of validate: date-pickers over free text, disable-invalid over reject-after-submit, confirm only for irreversible things. Guard slips: no destructive button adjacent to a frequent button, autosave drafts, warn on unsaved-changes navigation.
6. **Recognition rather than recall.** Show options, don't ask users to remember codes/syntax. Recently-used items surfaced. Field context visible at point of decision (plan limits shown ON the upgrade page). Placeholder text is NOT a label (disappears = recall burden).
7. **Flexibility and efficiency of use.** Accelerators for experts that novices can't see: keyboard shortcuts, bulk actions, recent/pinned items, deep links, sensible defaults prefilled from context. Frequent action ≤ 2 interactions away.
8. **Aesthetic and minimalist design.** Every extra element competes with the relevant ones. Progressive disclosure for advanced options. One primary action per screen. Kill decorative noise that carries no information.
9. **Help users recognize, diagnose, recover from errors.** Error text: what happened + why + what to do next, in plain language, next to where it happened. Preserve user input on failure. Never show raw codes/stacktraces alone; never blame the user ("Invalid input!").
10. **Help and documentation.** Best help is contextual: inline hints, empty-state guidance, tooltips on ambiguous icons, "?"-affordances at complex fields. Docs searchable, task-oriented ("How to invite a teammate"), short.

## Supporting laws (use to justify recommendations)

- **Fitts's Law:** targets ≥ 44×44px touch / comfortable pointer travel; frequent actions big and close; screen edges/corners are "infinite" targets on desktop.
- **Hick's Law:** decision time grows with choices — chunk menus, default the common path, progressive disclosure past ~7 options.
- **Miller / working memory:** don't make users carry info across screens; chunk long numbers/codes.
- **Peak-end rule:** invest in the flow's end (success screen, confirmation email) and its worst moment (error, wait).
- **Doherty threshold:** keep system response < 400ms where possible; mask latency with optimistic UI/skeletons.

## Audit protocol

1. Identify the top 1–3 user tasks for the screen/flow.
2. Walk each task as a first-time user; log violations against heuristics 1–10 with severity.
3. Re-walk as an expert user (heuristic 7 lens): count clicks/keystrokes for the frequent path.
4. Stress states: empty, loading, error, offline, slow network, long content, small viewport, keyboard-only, screen-reader labels.
5. Report: findings table sorted by severity, then top-3 fixes with effort estimate (S/M/L).
