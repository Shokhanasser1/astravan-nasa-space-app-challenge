---
name: executing-plans
description: Use when executing a written implementation plan from docs/plans/ in the current session, task by task, as the implementer yourself
---

# Executing Plans (HOME BY SEVEN)

Adapted from superpowers `executing-plans` (MIT, Jesse Vincent) for a five-person team that commits small changes
straight to `main` under a hackathon deadline. Self-contained: needs no other skill's scripts.

## Authority — read first

`CLAUDE.md` and `.claude/rules/` outrank the plan and this skill. You decide implementation details **inside your
lane** and keep going. You **stop and ask your human** when the next step would:

1. edit a file outside your lane (write the exact change for its owner instead — `CLAUDE.md`, Ownership);
2. change a shared contract (`View`, `rules.ts` signatures, `package.json`, `CLAUDE.md`, `.claude/`);
3. write or change a player-facing word (agents add keys with `""` only);
4. change a game rule or a golden number (report the mismatch; a rule change needs the whole team);
5. be irreversible or outward-facing (force-push, deleting data, publishing, `docker compose down -v`);
6. follow a plan that is wrong in a way that changes what gets built.

Anything else — an ambiguity, a small plan defect, a naming choice — decide, note it in the plan file under the
task as `Ruling: <what> — <why>`, and continue.

## Setup

1. `git pull --rebase`. Read the plan and its spec (`docs/specs/…`) fully once. List the tasks.
2. Progress lives **in the plan file**: each task's `- [ ]` steps become `- [x]` as you finish them, plus one line
   `Done: <commit sha> — <test command> → <result>` under the task. After a context reset, trust the plan file and
   `git log` over your memory; never redo a task that has a `Done:` line.
3. Work on `main` (team rule: small commits, `pull --rebase` before every push). Use a branch or worktree only if
   your human asks for one.

## Each task

1. Re-read the task's steps and files. Check they are all in your lane (else stop, rule 1).
2. Logic (`src/engine`, `src/state`, `src/audio`, `scripts/data`): test first — write the test, run it, see it fail
   for the right reason, write the minimum code, see it pass (`test-driven-development`). Scene/UI: produce the
   evidence the task names (`./shot.sh '<view>'`, e2e step, screenshot at 360×640).
3. Run the whole suite, not just your test: `npm test` (and `npm run check` if you touched i18n, assets or data).
4. Commit only this task's files: `git add <paths>` (never `git add -A` — other people's work may be in the tree),
   message `<type>: <description>`.
5. Before pushing: `git pull --rebase`, `npm run verify`, then push. Red → fix first, never push red.
6. Mark the steps `[x]`, add the `Done:` line, take the next task. Do not stop between tasks to ask "continue?".

A step fails twice in a row → `systematic-debugging` before the third try.

## Finish

1. `npm run verify` green; `npm run e2e` if the plan touched the flow of a day; `./shot.sh` if it touched the scene.
2. Review the whole change once with fresh eyes: `git diff <first-task-base>..HEAD`. If you can start a subagent,
   give it that diff, the plan and the spec and ask for bugs only; otherwise reread the diff yourself as a separate
   pass and say so. Fix real findings test-first; list the rest as "deferred".
3. Report to your human with `verification-before-completion`: what was built, the commands run and their real
   output, rulings you made, anything deferred or handed to another lane's owner.
