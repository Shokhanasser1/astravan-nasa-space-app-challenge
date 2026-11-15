import { Check, Circle, Star } from 'lucide-react';
import type { Model } from '../../state/game';
import { dayTasks, settled, type Seen } from '../../state/tasks';
import type { Tr } from './kit';
import './day-tasks.css';

/**
 * "Today's 5" (home story, step 3): the day's five tasks from src/state/tasks.ts, ticked by the plan itself — the
 * child never ticks anything. The first open task is lit (the beacon stands over its machine); all five → the day's
 * star lights. Words only: ui.today.*, ui.task.<id>. Behind features.homeStory; the HUD places it (replaces TaskLine).
 * `rounded-[16px]` picks the HUD frame's small notification skin (src/ui/flight-deck.css: no status dots under the star).
 */
export function DayTasks({ model, tr, seen }: { model: Model; tr: Tr; seen?: Seen }) {
  const tasks = dayTasks(model, seen);
  if (!tasks.length) return null;
  // (an optional task — Day 7's robot arm — never holds the star or the light; it ticks when it is done)
  const current = tasks.findIndex((t) => !settled(t));
  const count = tasks.filter(settled).length;
  const star = current === -1;
  return (
    <section className="holo day-tasks pointer-events-auto rounded-[16px]" data-testid="day-tasks" data-star={star ? 'true' : 'false'}>
      <header className="day-tasks__head">
        <h2 className="day-tasks__title">{tr('ui.today.title')}</h2>
        <span className="day-tasks__count" aria-hidden="true">
          {count}/{tasks.length}
        </span>
        <Star
          size={18}
          className={`day-tasks__star ${star ? 'is-lit' : ''}`}
          fill={star ? 'currentColor' : 'none'}
          role={star ? 'img' : undefined}
          aria-label={star ? tr('ui.today.star') : undefined}
          aria-hidden={star ? undefined : true}
          data-testid="day-star"
        />
      </header>
      <ol className="day-tasks__list">
        {tasks.map((t, i) => (
          <li
            key={t.id}
            data-testid={`task-${t.id}`}
            data-done={t.done ? 'true' : 'false'}
            aria-current={i === current ? 'step' : undefined}
            className={`day-task ${t.done ? 'is-done' : ''} ${i === current ? 'is-current' : ''} ${t.optional ? 'is-optional' : ''}`}
          >
            <span className="day-task__mark">
              {t.done ? (
                <Check size={14} strokeWidth={3} role="img" aria-label={tr('ui.today.done')} />
              ) : (
                <Circle size={14} aria-hidden="true" />
              )}
            </span>
            <span className="day-task__text">{tr(`ui.task.${t.id}`, t.n != null ? { n: t.n } : undefined)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
