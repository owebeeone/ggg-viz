// Cross-cutting invariants, evaluated over every trace's folded state at every
// step. Traces are paths; these are the rules no path may break — the upgrade
// from picture book to executable spec.
import { actorStateAt } from './fold';
import type { Scenario } from './types';
import { stepId } from './types';

// OPS deliveries that represent SERVING an interest (vs heads-driven sync,
// which is exempt: B7/B8 reconcile replicas without a subscription).
const SERVE_STATES = new Set(['A5', 'B9', 'C5', 'C6', 'W2', 'W3', 'J2']);

export function checkInvariants(scenario: Scenario): string[] {
  const errors: string[] = [];
  const temp = new Set(scenario.actors.filter((a) => a.temp).map((a) => a.id));
  const roleOf = new Map(scenario.actors.map((a) => [a.id, a.role]));

  scenario.steps.forEach((step, i) => {
    const state = actorStateAt(scenario, i); // inclusive of this step's sets
    const id = `${scenario.id}/${stepId(step)}[${i}]`;

    // INV-1: temp actors participate in messages only while alive.
    if (step.kind === 'message') {
      for (const end of [step.from, step.to!]) {
        if (temp.has(end) && state.get(end)?.alive === undefined) {
          errors.push(`${id}: temp actor '${end}' used while not alive (INV-1)`);
        }
      }
    }

    // INV-2: a serving OPS delivery requires the receiver to appear in some
    // subscription entry at the sender — you cannot serve interest that was
    // never registered. (This is what catches "cached ≠ allowed" leaks.)
    if (step.kind === 'message' && step.frame === 'OPS' && SERVE_STATES.has(step.state)) {
      const sender = state.get(step.from) ?? {};
      const served = Object.entries(sender).some(
        ([k, v]) => k.startsWith('sub ') && String(v).includes(step.to!),
      );
      if (!served) {
        errors.push(
          `${id}: OPS to '${step.to}' but no 'sub …' entry at '${step.from}' names it (INV-2)`,
        );
      }

      // INV-4 (stage 2 only): serving a non-home share to a client/service
      // session requires a matching grant in the SENDER's fold at that step —
      // GladeAuthzModel §4's closure ("policy rides the share") checked
      // mechanically. Node↔node replication is node-trust, not user grants.
      const share = step.payload?.share;
      const rxRole = roleOf.get(step.to!);
      if (
        scenario.stage === 2 &&
        share &&
        share !== 'home' &&
        (rxRole === 'client' || rxRole === 'service')
      ) {
        const grantKey = `grant ${step.to} ${share}`;
        if (!(grantKey in sender)) {
          errors.push(
            `${id}: OPS serves '${share}' to '${step.to}' but '${step.from}' fold has no '${grantKey}' (INV-4)`,
          );
        }
      }
    }
  });

  // INV-5 (stage 2, opt-in via an `operator` state key): a node may carry
  // `replica <share>` state only if its `hold <share>` entry names its
  // operator — AuthzModel §7a's placement rule, checked at every step.
  if (scenario.stage === 2) {
    scenario.steps.forEach((_, i) => {
      const state = actorStateAt(scenario, i);
      for (const [actor, kv] of state) {
        const op = kv['operator'];
        if (!op) continue;
        for (const k of Object.keys(kv)) {
          const m = k.match(/^replica (\S+)$/);
          if (!m || m[1] === 'home') continue;
          const hold = kv[`hold ${m[1]}`];
          if (!hold || !String(hold).includes(op)) {
            errors.push(
              `${scenario.id}[${i}]: '${actor}' (operator ${op}) holds replica of '${m[1]}' without matching 'hold ${m[1]}' (INV-5)`,
            );
          }
        }
      }
    });
  }

  // INV-3: no two actors hold the same claim at the same epoch, at any step.
  // (Distinct epochs may coexist transiently — the fold + fencing resolve.)
  scenario.steps.forEach((_, i) => {
    const state = actorStateAt(scenario, i);
    const held = new Map<string, string>(); // "workspace@epoch" → actor
    for (const [actor, kv] of state) {
      for (const [k, v] of Object.entries(kv)) {
        const m = k.match(/^claim (\S+)$/);
        const e = String(v).match(/held — epoch (\d+)/);
        if (m && e) {
          const key = `${m[1]}@${e[1]}`;
          const prior = held.get(key);
          if (prior && prior !== actor) {
            errors.push(
              `${scenario.id}[${i}]: '${prior}' and '${actor}' both hold ${key} (INV-3)`,
            );
          }
          held.set(key, actor);
        }
      }
    }
  });

  return errors;
}
