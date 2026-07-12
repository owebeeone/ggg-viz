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
      // Ruled refinements (AZ-16/AZ-17, 2026-07-10):
      //  · private-zone serves ride the receiver's MEMBERSHIP grant — no
      //    zone-scoped grant ever exists; which zone you receive is routing
      //    (keying), not policy (AZ-16; GladeZones · privacy is a key).
      //  · account domains are OWNER-exempt: a sender fold entry
      //    `account <share>: <session>` names the owning session, which needs
      //    no grant record (self-lockout is unrepresentable); any OTHER
      //    receiver of an account share still needs a grant (AZ-17).
      const share = step.payload?.share;
      const rxRole = roleOf.get(step.to!);
      if (
        scenario.stage === 2 &&
        share &&
        share !== 'home' &&
        (rxRole === 'client' || rxRole === 'service')
      ) {
        const ownerExempt = sender[`account ${share}`] === step.to;
        const grantKey = `grant ${step.to} ${share}`;
        if (!ownerExempt && !(grantKey in sender)) {
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

  // INV-6 (glade-users §1.2): after the fold, no two principal records share a
  // fingerprint. The principal fold is keyed by FINGERPRINT (set-union dedup),
  // so a key introduced by any invite path — in any order, on any node —
  // converges to EXACTLY ONE principal on every view. A fold entry
  // `principal <id>` whose value carries `fp:<hex>` is a folded principal; the
  // check spans every actor at every step, so it catches both an intra-fold
  // duplicate (two records, one fingerprint) and cross-view divergence (two
  // nodes disagree on who a fingerprint is). Opt-in by shape: traces with no
  // `principal <id>` / `fp:` entries are unaffected (all pre-users traces).
  scenario.steps.forEach((_, i) => {
    const state = actorStateAt(scenario, i);
    const owner = new Map<string, string>(); // fingerprint → principal id
    for (const [, kv] of state) {
      for (const [k, v] of Object.entries(kv)) {
        const m = k.match(/^principal (\S.*)$/);
        const fp = String(v).match(/\bfp:(\w+)/);
        if (!m || !fp) continue;
        const id = m[1];
        const prior = owner.get(fp[1]);
        if (prior && prior !== id) {
          errors.push(
            `${scenario.id}[${i}]: fingerprint '${fp[1]}' maps to both '${prior}' and '${id}' — two principal records share a fingerprint (INV-6)`,
          );
        } else {
          owner.set(fp[1], id);
        }
      }
    }
  });

  return errors;
}
