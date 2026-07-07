import { describe, expect, it } from 'vitest';
import { commentedSteps, commentsForScenario, openCount, otherScenarioCount } from './model';
import type { TraceComment } from './types';

const c = (id: string, scenarioId: string, stepIndex: number, status: 'open' | 'addressed' = 'open', at = '2026-07-05T00:00:00Z'): TraceComment => ({
  id, at, status, scenarioId, stepIndex,
  stepId: 'A1', phase: 'A', focusedActor: null, pinnedStep: null, text: 'note',
});

const ALL = [
  c('1', 's-discovery', 5),
  c('2', 's-fanout', 3),
  c('3', 's-discovery', 1, 'addressed'),
  c('4', 's-discovery', 5, 'open', '2026-07-05T01:00:00Z'),
];

describe('comment model', () => {
  it('filters and orders per scenario by step then time', () => {
    expect(commentsForScenario(ALL, 's-discovery').map((x) => x.id)).toEqual(['3', '1', '4']);
  });

  it('counts comments in other scenarios', () => {
    expect(otherScenarioCount(ALL, 's-discovery')).toBe(1);
  });

  it('collects commented step indices', () => {
    expect([...commentedSteps(ALL, 's-discovery')].sort()).toEqual([1, 5]);
  });

  it('counts open comments across the suite', () => {
    expect(openCount(ALL)).toBe(3);
  });
});
