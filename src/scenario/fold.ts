// Pure folds over the scenario — the only logic in the app. Components project.
import type { CatalogState, Scenario, Step } from './types';
import { stepId } from './types';

export type Activity = 'idle' | 'sending' | 'receiving' | 'working' | 'gated';

export interface Edge {
  from: string;
  to: string;
  response: boolean;
}

export type ActorState = Map<string, Record<string, string>>;

export function clampStep(scenario: Scenario, i: number): number {
  if (scenario.steps.length === 0) return 0;
  return Math.max(0, Math.min(i, scenario.steps.length - 1));
}

export function stepAt(scenario: Scenario, i: number): Step {
  return scenario.steps[clampStep(scenario, i)];
}

export function edgeForStep(step: Step): Edge | null {
  if (step.kind !== 'message' || !step.to) return null;
  return { from: step.from, to: step.to, response: step.response ?? false };
}

export function activityAt(scenario: Scenario, i: number): Map<string, Activity> {
  const map = new Map<string, Activity>(scenario.actors.map((a) => [a.id, 'idle']));
  if (scenario.steps.length === 0) return map;
  const s = stepAt(scenario, i);
  if (s.kind === 'message' && s.to) {
    map.set(s.from, 'sending');
    map.set(s.to, 'receiving');
  } else {
    map.set(s.from, s.gate ? 'gated' : 'working');
  }
  return map;
}

export function traceUpTo(scenario: Scenario, i: number): Step[] {
  if (scenario.steps.length === 0) return [];
  return scenario.steps.slice(0, clampStep(scenario, i) + 1);
}

// Fold the per-step state patches (initial + steps 0..i) into each actor's
// visible state — the same op-log→fold model the protocol itself uses.
export function actorStateAt(scenario: Scenario, i: number): ActorState {
  const state: ActorState = new Map(scenario.actors.map((a) => [a.id, {}]));
  const apply = (patch: Scenario['initial']) => {
    if (!patch) return;
    for (const [actor, kv] of Object.entries(patch)) {
      const cur = state.get(actor) ?? {};
      for (const [k, v] of Object.entries(kv)) {
        if (v === null) delete cur[k];
        else cur[k] = v;
      }
      state.set(actor, cur);
    }
  };
  apply(scenario.initial);
  if (scenario.steps.length > 0) {
    const top = clampStep(scenario, i);
    for (let s = 0; s <= top; s++) apply(scenario.steps[s].sets);
  }
  return state;
}

// A temp actor is visible only while its folded state carries an `alive` key.
export function visibleActorsAt(scenario: Scenario, i: number): string[] {
  const state = actorStateAt(scenario, i);
  return scenario.actors
    .filter((a) => !a.temp || state.get(a.id)?.alive !== undefined)
    .map((a) => a.id);
}

export function validateScenario(
  scenario: Scenario,
  catalog?: Record<string, CatalogState>,
): string[] {
  const errors: string[] = [];
  const actorIds = new Set(scenario.actors.map((a) => a.id));
  if (actorIds.size !== scenario.actors.length) errors.push('duplicate actor ids');
  const phaseIndex = new Map(scenario.phases.map((p, i) => [p.id, i]));

  const exchangeCorrelations = new Set(
    scenario.steps
      .filter((s) => s.frame === 'EXCHANGE' && s.payload?.correlationId)
      .map((s) => s.payload!.correlationId!),
  );

  const checkPatch = (patch: Scenario['initial'], where: string) => {
    for (const actor of Object.keys(patch ?? {})) {
      if (!actorIds.has(actor)) errors.push(`${where}: state patch for unknown actor '${actor}'`);
    }
  };
  checkPatch(scenario.initial, `${scenario.id} initial`);

  let lastPhase = -1;
  for (const s of scenario.steps) {
    const id = stepId(s);

    if (!actorIds.has(s.from)) errors.push(`step ${id}: unknown actor '${s.from}'`);
    if (s.to !== undefined && !actorIds.has(s.to)) errors.push(`step ${id}: unknown actor '${s.to}'`);

    if (s.kind === 'message' && !s.to) errors.push(`message step ${id} missing 'to'`);
    if (s.kind === 'internal' && s.to) errors.push(`internal step ${id} must not have 'to'`);
    if (s.response && s.kind !== 'message') errors.push(`step ${id}: response flag on non-message`);

    const pi = phaseIndex.get(s.phase);
    if (pi === undefined) {
      errors.push(`step ${id}: unknown phase '${s.phase}'`);
    } else {
      if (pi < lastPhase) errors.push(`step ${id}: out of phase order`);
      lastPhase = Math.max(lastPhase, pi);
    }

    if (s.frame === 'EXCHANGE-RESP') {
      const c = s.payload?.correlationId;
      if (!c) errors.push(`step ${id}: EXCHANGE-RESP without correlation id`);
      else if (!exchangeCorrelations.has(c))
        errors.push(`step ${id}: correlation '${c}' has no EXCHANGE request`);
    }

    if (!s.note.trim()) errors.push(`step ${id}: empty note — every step must document itself`);
    if (s.gate && !s.gate.note.trim()) errors.push(`step ${id}: gate missing note`);
    if (s.variant && !s.variantNote?.trim())
      errors.push(`step ${id}: variant without variantNote — declare the twist`);
    checkPatch(s.sets, `step ${id}`);

    // The atlas contract: same state id ⇒ same protocol shape, everywhere.
    if (catalog) {
      const cat = catalog[s.state];
      if (!cat) {
        errors.push(`step ${id}: state '${s.state}' not in catalog`);
      } else {
        if (s.frame !== cat.frame)
          errors.push(`step ${id}: frame ${s.frame} ≠ catalog ${cat.frame}`);
        if (s.kind !== cat.kind) errors.push(`step ${id}: kind ${s.kind} ≠ catalog ${cat.kind}`);
        if (s.gate && cat.gateKind && s.gate.kind !== cat.gateKind)
          errors.push(`step ${id}: gate ${s.gate.kind} ≠ catalog ${cat.gateKind}`);
      }
    }
  }
  return errors;
}
