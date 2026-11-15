import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { Lang } from '../../i18n/t';
import { shownDay, type Model } from '../../state/game';
import { Mark } from './Holo';
import type { Tr } from './kit';
import { DATED_FACTS, factsNow, factUnit, factValue, loadFacts, nightFactId, type Fact } from './night-facts';
import './night-fact.css';

/**
 * The night card's one astronaut fact (home story, step 4): the fact of the day just lived, its value and unit with
 * the data mark (measured / computed, from facts.json) and the source's name. The sentence is data.fact.<id> (the
 * Data page's words) while it is written, else ui.fact.<id>; a sentence that names the week's date never shows here.
 * Asilbek's radio-check quiz asks about this same fact (one mechanism). The HUD places it on the night card.
 */
export function NightFact({ model, tr, lang = 'en' }: { model: Model; tr: Tr; lang?: Lang }) {
  const id = nightFactId(shownDay(model));
  const [facts, setFacts] = useState<Fact[] | null>(factsNow);
  useEffect(() => {
    let live = true;
    void loadFacts().then((f) => live && setFacts(f));
    return () => {
      live = false;
    };
  }, []);

  const fact = facts?.find((f) => f.id === id);
  if (!model.game || !fact) return null;

  const own = DATED_FACTS.has(id) ? '' : tr(fact.key);
  const text = own && own !== fact.key ? own : tr(`ui.fact.${id}`);
  const unit = factUnit(fact.unit);
  return (
    <section className="night-fact" data-testid="night-fact" data-fact={id}>
      <header className="night-fact__head">
        <Lightbulb size={16} aria-hidden="true" />
        <h3 className="night-fact__title">{tr('ui.fact.title')}</h3>
      </header>
      <p className="night-fact__value">
        <span className="night-fact__number">{factValue(fact.value, fact.unit, lang)}</span>
        {unit && <span className="night-fact__unit"> {unit}</span>}
        <Mark label={fact.label} tr={tr} />
      </p>
      <p className="night-fact__text">{text}</p>
      <p className="night-fact__source">{tr('ui.fact.source', { name: fact.source.title })}</p>
    </section>
  );
}
