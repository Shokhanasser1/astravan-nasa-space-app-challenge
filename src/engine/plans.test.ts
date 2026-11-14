import { describe, it } from 'vitest';
import { ENGINE_IS_STUB } from './rules';

/**
 * Golden plans (concept v2 §10; developer guide §08, prompt A). Week 2021-10-25, cards Shadow (day 2) and Ice (day 3).
 * Lane A: when rules.ts is the real port, write the three plans day by day and remove ENGINE_IS_STUB.
 * Never change a rule to make a test pass: report the mismatch instead.
 */
describe.skipIf(ENGINE_IS_STUB)('golden plans, week 2021-10-25', () => {
  it.todo('Plan A → crew 7, science 14, 77% blocked, title "Balance Master"');
  it.todo('Plan B → crew 3, science 19');
  it.todo('Plan C → crew 8, science 9');
  it.todo('Plan A played through the reducer gives the same result (lane B)');
});
