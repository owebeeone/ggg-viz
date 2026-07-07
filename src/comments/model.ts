// Pure helpers over the comment set — the only logic; the panel projects.
import type { TraceComment } from './types';

export function commentsForScenario(all: readonly TraceComment[], scenarioId: string): TraceComment[] {
  return all
    .filter((c) => c.scenarioId === scenarioId)
    .sort((a, b) => a.stepIndex - b.stepIndex || a.at.localeCompare(b.at));
}

export function otherScenarioCount(all: readonly TraceComment[], scenarioId: string): number {
  return all.filter((c) => c.scenarioId !== scenarioId).length;
}

// Step indices that carry at least one comment (slider ticks / trace dots).
export function commentedSteps(all: readonly TraceComment[], scenarioId: string): Set<number> {
  return new Set(commentsForScenario(all, scenarioId).map((c) => c.stepIndex));
}

export function openCount(all: readonly TraceComment[]): number {
  return all.filter((c) => c.status === 'open').length;
}
