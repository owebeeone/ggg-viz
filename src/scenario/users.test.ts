// The glade-users spine traces are the executable spec for GLP-0006's identity
// layer: the principal IS the key (fingerprint-canonical); onboarding is a
// ceremony recorded as data; names are self-asserted attributes discriminated
// by fingerprint; and the fold converges to exactly one principal per
// fingerprint regardless of invite order (INV-6).
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { validateScenario, actorStateAt } from './fold';
import { S_INVITE, S_NAME_CLASH, S_CONVERGE_IDENTITY } from './users';

const finalState = (sc: typeof S_INVITE, actor: string) =>
  actorStateAt(sc, sc.steps.length - 1).get(actor)!;

// principal <id> → fingerprint, extracted from a folded state.
const principalMap = (fold: Record<string, string>): Record<string, string> => {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(fold)) {
    const mk = k.match(/^principal (.+)$/);
    const fp = String(v).match(/\bfp:(\w+)/);
    if (mk && fp) m[mk[1]] = fp[1];
  }
  return m;
};

describe('s-invite — onboard a new principal (the ceremony as data)', () => {
  const steps = S_INVITE.steps;

  it('is a stage-1 trace that validates and holds the invariants (incl. INV-6)', () => {
    expect(S_INVITE.stage).toBe(1);
    expect(validateScenario(S_INVITE, CATALOG)).toEqual([]);
    expect(checkInvariants(S_INVITE)).toEqual([]);
  });

  it('mints an InviteRecord with a token and a session-placement URL', () => {
    const mint = steps.find((s) => s.state === 'U1')!;
    expect(mint.frame).toBe('APPEND');
    const p = JSON.stringify(mint.payload);
    expect(p).toMatch(/InviteRecord/);
    expect(p).toMatch(/token/);
    expect(p).toMatch(/bootstrap/); // the session-placement URL (GDL-032)
  });

  it('the newcomer presents/mints a KEY at accept — identity is the fingerprint', () => {
    const accept = steps.find((s) => s.state === 'U2')!;
    expect(accept.frame).toBe('HELLO');
    const p = JSON.stringify(accept.payload);
    expect(p).toMatch(/fp:9c2e/); // the principal id IS the key fingerprint
    expect(p).toMatch(/device key/i);
  });

  it('appends a PrincipalRecord keyed by FINGERPRINT + an IntroductionRecord (sponsorship edge)', () => {
    const principal = steps.find((s) => s.state === 'U4')!;
    expect(principal.frame).toBe('APPEND');
    expect(JSON.stringify(principal.payload)).toMatch(/fingerprint/i);
    expect(principal.payload?.gladeId).toBe('dir.principals');
    // the fold key IS the fingerprint.
    expect(finalState(S_INVITE, 'local1')['principal dana']).toMatch(/fp:9c2e/);

    const intro = steps.find((s) => s.state === 'U5')!;
    expect(JSON.stringify(intro.payload)).toMatch(/IntroductionRecord/);
    expect(JSON.stringify(intro.payload)).toMatch(/sponsor/i);
    expect(intro.payload?.gladeId).toBe('users.introductions');
  });

  it('both sides converge on the SAME principal (one fingerprint, every view)', () => {
    expect(steps.some((s) => s.state === 'U6')).toBe(true);
    // gianni's view, dana's own view, and the node all carry dana @ fp:9c2e.
    expect(finalState(S_INVITE, 'gryth1')['principal dana']).toMatch(/fp:9c2e/);
    expect(finalState(S_INVITE, 'guest1')['principal dana']).toMatch(/fp:9c2e/);
    expect(finalState(S_INVITE, 'local1')['converged fp:9c2e']).toBeTruthy();
  });

  it('a replayed invite fails as DATA and mints NO records', () => {
    // exactly ONE principal is ever minted across the whole trace (dana) —
    // the replay adds none.
    expect(steps.filter((s) => s.state === 'U4').length).toBe(1);
    // the replay phase mints no PrincipalRecord/IntroductionRecord at all.
    const replayPhase = steps.filter((s) => s.phase === 'IX');
    expect(replayPhase.some((s) => s.state === 'U4' || s.state === 'U5')).toBe(false);
    // and the rejection is a directed ok:false answer (absence as a value).
    const reject = steps.find((s) => s.state === 'U7')!;
    expect(reject.frame).toBe('EXCHANGE-RESP');
    expect(JSON.stringify(reject.payload)).toMatch(/false/);
  });
});

describe('s-name-clash — two freds, discriminated by fingerprint', () => {
  const steps = S_NAME_CLASH.steps;

  it('is a stage-1 trace that validates and holds the invariants', () => {
    expect(S_NAME_CLASH.stage).toBe(1);
    expect(validateScenario(S_NAME_CLASH, CATALOG)).toEqual([]);
    expect(checkInvariants(S_NAME_CLASH)).toEqual([]);
  });

  it('two DISTINCT principals self-assert the SAME display name', () => {
    const asserts = steps.filter((s) => s.state === 'U8');
    expect(asserts.length).toBe(2);
    // both assert the name "fred"...
    for (const a of asserts) expect(JSON.stringify(a.payload)).toMatch(/name.*fred/);
    // ...from two different sessions / keys.
    expect(new Set(asserts.map((s) => s.from)).size).toBe(2);
    const fold = finalState(S_NAME_CLASH, 'local1');
    const fps = principalMap(fold);
    // two freds, two fingerprints — INV-6 holds because names ≠ identity.
    expect(fps['fred-1']).not.toBe(fps['fred-2']);
  });

  it('the rendering rule shows name·fp6 wherever they collide', () => {
    const render = steps.find((s) => s.state === 'U9')!;
    expect(render.frame).toBe('FOLD');
    const fold = actorStateAt(S_NAME_CLASH, steps.indexOf(render)).get('local1')!;
    expect(fold['render fred-1']).toMatch(/fred·a1b2/);
    expect(fold['render fred-2']).toMatch(/fred·b7c9/);
    expect(fold['render fred-1']).not.toBe(fold['render fred-2']); // discriminated
  });

  it('first-valid-claim-wins: the earlier claim takes the bare handle, the later renders suffixed', () => {
    const claims = steps.filter((s) => s.state === 'U10');
    expect(claims.length).toBe(2);
    // fred-1 claims first (chain order t1), fred-2 second.
    expect(claims[0].from).toBe('gryth1');
    expect(claims[1].from).toBe('guest1');
    const resolve = steps.find((s) => s.state === 'U11')!;
    const fold = actorStateAt(S_NAME_CLASH, steps.indexOf(resolve)).get('local1')!;
    expect(fold['handle acme/fred']).toMatch(/fred-1/); // first valid claim wins
    expect(fold['render fred-2 @acme']).toMatch(/fred·b7c9/); // loser is suffixed
  });

  it('a petname overrides display for the VIEWER alone (their own account domain, not replicated)', () => {
    const petname = steps.find((s) => s.state === 'U12')!;
    expect(petname.frame).toBe('FOLD');
    const fold = finalState(S_NAME_CLASH, 'local1');
    // the petname is stored in the viewer's OWN account domain.
    const petKey = Object.keys(fold).find((k) => k.startsWith('fold acct-viewer/petnames'));
    expect(petKey).toBeTruthy();
    // it wins in the viewer's render alone...
    expect(fold['render fred-2 @gryth3']).toMatch(/fred \(work\)/);
    // ...while the GLOBAL render of fred-2 is untouched (still fingerprint-suffixed).
    expect(fold['render fred-2']).toMatch(/fred·b7c9/);
    expect(fold['render fred-2']).not.toMatch(/work/);
  });
});

describe('s-converge-identity — one principal per fingerprint, any order', () => {
  const steps = S_CONVERGE_IDENTITY.steps;

  it('is a stage-1 trace that validates and holds the invariants (incl. INV-6)', () => {
    expect(S_CONVERGE_IDENTITY.stage).toBe(1);
    expect(validateScenario(S_CONVERGE_IDENTITY, CATALOG)).toEqual([]);
    expect(checkInvariants(S_CONVERGE_IDENTITY)).toEqual([]);
  });

  it('u2 — reached by TWO invite paths — folds to exactly ONE principal on each node', () => {
    for (const node of ['local1', 'local2']) {
      const fold = finalState(S_CONVERGE_IDENTITY, node);
      const u2keys = Object.keys(fold).filter((k) => /^principal u2\b/.test(k));
      expect(u2keys.length).toBe(1); // never a duplicate
      expect(fold['principal u2']).toMatch(/fp:2222/);
      // two sponsorship edges reach the ONE u2 (u1→u2 and u3→u2).
      expect(fold['edge u1→u2']).toBeTruthy();
      expect(fold['edge u3→u2']).toBeTruthy();
    }
  });

  it('the two nodes fold the same records in DIFFERENT orders', () => {
    const firstOf = (phase: string, node: string) =>
      steps.find((s) => s.phase === phase && s.from === node && s.state === 'U5');
    const nodeAfirst = firstOf('CA', 'local1'); // u1→u2 first
    const nodeBfirst = firstOf('CB', 'local2'); // u3→u1 first
    expect(JSON.stringify(nodeAfirst!.payload)).toMatch(/u1.*u2/);
    expect(JSON.stringify(nodeBfirst!.payload)).toMatch(/u3.*u1|3333.*1111/);
  });

  it('every view converges to the SAME set — one principal per fingerprint', () => {
    const a = principalMap(finalState(S_CONVERGE_IDENTITY, 'local1'));
    const b = principalMap(finalState(S_CONVERGE_IDENTITY, 'local2'));
    // three principals, three distinct fingerprints, on each node.
    expect(Object.keys(a).sort()).toEqual(['u1', 'u2', 'u3']);
    expect(new Set(Object.values(a)).size).toBe(3);
    // the two nodes agree exactly — sequence-independent convergence.
    expect(a).toEqual(b);
    expect(a).toEqual({ u1: '1111', u2: '2222', u3: '3333' });
  });
});
