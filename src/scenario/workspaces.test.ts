// The glade-workspaces spine traces are the executable spec for GLP-0006's
// hosting layer: a peer hosts N workspaces (name→root app-owned); the directory
// lists them with claim/liveness; selection (client-context) drives the tool
// target; creation materializes records+disk commit-or-fail together; and a
// clone births a second eligible host — glade carrying only records.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { validateScenario, actorStateAt } from './fold';
import { S_WS_HOST, S_WS_CREATE, S_WS_CLONE } from './workspaces';

const finalState = (sc: typeof S_WS_HOST, actor: string) =>
  actorStateAt(sc, sc.steps.length - 1).get(actor)!;

describe('s-ws-host — two workspaces, selection drives the target', () => {
  const steps = S_WS_HOST.steps;

  it('is a stage-1 trace that validates and holds the invariants', () => {
    expect(S_WS_HOST.stage).toBe(1);
    expect(validateScenario(S_WS_HOST, CATALOG)).toEqual([]);
    expect(checkInvariants(S_WS_HOST)).toEqual([]);
  });

  it('one peer hosts TWO workspaces, each with its own gwz root + entry + claim', () => {
    const peer = finalState(S_WS_HOST, 'peer1');
    expect(peer['host ws-alpha']).toBeTruthy();
    expect(peer['host ws-beta']).toBeTruthy();
    expect(peer['claim ws-alpha']).toMatch(/epoch 1/);
    expect(peer['claim ws-beta']).toMatch(/epoch 1/);
    // two WorkspaceEntry appends (K1) — one per workspace.
    expect(steps.filter((s) => s.state === 'K1').length).toBe(2);
    // the directory serve lists BOTH with liveness (claim state).
    const listing = steps.find((s) => s.state === 'A5' && s.payload?.gladeId === 'dir.workspaces')!;
    const lp = JSON.stringify(listing.payload);
    expect(lp).toMatch(/ws-alpha/);
    expect(lp).toMatch(/ws-beta/);
    expect(lp).toMatch(/live/);
  });

  it('the name→root mapping is APP-OWNED (an internal fold, the data seam)', () => {
    const map = steps.find((s) => s.state === 'X1')!;
    expect(map.kind).toBe('internal'); // never rides a request
    expect(map.to).toBeUndefined();
    const p = JSON.stringify(map.payload);
    expect(p).toMatch(/app-owned|data seam/i);
    // the real gwz root path never appears on a wire (SUBSCRIBE/EXCHANGE) payload.
    for (const s of steps.filter((x) => x.frame === 'SUBSCRIBE' || x.frame === 'EXCHANGE')) {
      expect(JSON.stringify(s.payload ?? {})).not.toMatch(/\/srv\/gwz\//);
    }
  });

  it('the empty (zero-member) workspace enumerates HONESTLY', () => {
    const empty = steps.find((s) => s.state === 'X2' && s.variant === 'a')!;
    expect(empty).toBeTruthy();
    expect(empty.payload?.share).toBe('ws-beta');
    const p = JSON.stringify(empty.payload);
    expect(p).toMatch(/0|\[\]/); // zero members
    expect(p).toMatch(/honest/i);
    expect(finalState(S_WS_HOST, 'local1')['fold ws-beta/ws.members']).toMatch(/0 members/);
  });

  it('selection (client-context) drives which workspace a tool request targets', () => {
    const select = steps.findIndex((s) => s.state === 'X3');
    const route = steps.findIndex((s) => s.state === 'X4');
    expect(select).toBeGreaterThanOrEqual(0);
    expect(select).toBeLessThan(route); // select, THEN the tool routes by selection
    // the selection is a grip-side value on the client.
    expect(finalState(S_WS_HOST, 'gryth1')['ws.selection']).toMatch(/ws-alpha/);
    // the tool request resolves its target FROM the selection, then routes to the host.
    expect(JSON.stringify(steps[route].payload)).toMatch(/selection/i);
    const forward = steps.find((s) => s.frame === 'EXCHANGE' && s.to === 'peer1' && s.payload?.verb === 'workspace.status');
    expect(forward).toBeTruthy(); // the op reached the selected workspace's host
  });
});

describe('s-ws-create — records + disk commit-or-fail together', () => {
  const steps = S_WS_CREATE.steps;
  const inPhase = (phase: string) => steps.filter((s) => s.phase === phase);

  it('is a stage-1 trace that validates and holds the invariants', () => {
    expect(S_WS_CREATE.stage).toBe(1);
    expect(validateScenario(S_WS_CREATE, CATALOG)).toEqual([]);
    expect(checkInvariants(S_WS_CREATE)).toEqual([]);
  });

  it('adds the MATERIALIZATION leg: disk (gwz init) commits BEFORE the directory records', () => {
    const mt = inPhase('MT');
    const disk = mt.findIndex((s) => s.state === 'X5');
    const entry = mt.findIndex((s) => s.state === 'K1');
    const claim = mt.findIndex((s) => s.state === 'H1');
    expect(disk).toBeGreaterThanOrEqual(0);
    expect(disk).toBeLessThan(entry); // records are downstream of disk success
    expect(disk).toBeLessThan(claim);
    expect(JSON.stringify(mt[disk].payload)).toMatch(/commit-or-fail|gwz init/i);
  });

  it('shows BOTH target-routed and self-routed variants', () => {
    // target-routed: routes to peer3 and FORWARDS (a D2 hop exists).
    expect(inPhase('MT').some((s) => s.state === 'D2' && s.to === 'peer3')).toBe(true);
    // self-routed: the route is the C2 self variant, and there is NO forward hop.
    const selfRoute = inPhase('MS').find((s) => s.state === 'C2');
    expect(selfRoute?.variant).toBe('a');
    expect(inPhase('MS').some((s) => s.state === 'D2')).toBe(false);
    // self still materializes (X5 on the local node).
    expect(inPhase('MS').some((s) => s.state === 'X5' && s.from === 'local1')).toBe(true);
  });

  it('failure is DATA and mints NO records (the commit-or-fail contract)', () => {
    const mf = inPhase('MF');
    expect(mf.some((s) => s.state === 'X6')).toBe(true); // materialization failed
    // no WorkspaceEntry (K1) and no ServeClaim (H1) are minted on failure.
    expect(mf.some((s) => s.state === 'K1' || s.state === 'H1')).toBe(false);
    // the failure comes back as an ok:false answer.
    const resp = mf.find((s) => s.state === 'D4')!;
    expect(JSON.stringify(resp.payload)).toMatch(/false|nothing/);
  });
});

describe('s-ws-clone — a second host is born', () => {
  const steps = S_WS_CLONE.steps;

  it('is a stage-1 trace that validates and holds the invariants', () => {
    expect(S_WS_CLONE.stage).toBe(1);
    expect(validateScenario(S_WS_CLONE, CATALOG)).toEqual([]);
    expect(checkInvariants(S_WS_CLONE)).toEqual([]);
  });

  it('materializes via gwz clone over git remotes — glade carries only the records', () => {
    const clone = steps.find((s) => s.state === 'X7')!;
    expect(clone.frame).toBe('PROVIDE');
    const p = JSON.stringify(clone.payload);
    expect(p).toMatch(/gwz clone/i);
    expect(p).toMatch(/git remotes/i);
    expect(p).toMatch(/records/i); // glade carries only the records
    // the home-share replication that follows carries records only — not the tree.
    const repl = steps.find((s) => s.state === 'B9' && s.from === 'peer2')!;
    expect(JSON.stringify(repl.payload)).toMatch(/WorkspaceEntry|ReplicaHint/);
  });

  it('registers eligibility and the directory converges to TWO eligible hosts', () => {
    const elig = steps.find((s) => s.state === 'X8')!;
    expect(elig.frame).toBe('APPEND');
    expect(JSON.stringify(elig.payload)).toMatch(/eligible/i);
    expect(finalState(S_WS_CLONE, 'peer2')['eligible ws-shared']).toBeTruthy();
    // the node's directory fold and the UI both show two eligible hosts.
    expect(finalState(S_WS_CLONE, 'local1')['fold home']).toMatch(/\[peer1, peer2\]/);
    expect(finalState(S_WS_CLONE, 'gryth1').view).toMatch(/2 eligible hosts/);
  });

  it('does not displace the source’s live claim (a warm second host, not a takeover)', () => {
    // peer1 keeps its epoch-1 serve; peer2 is eligible + advertised, not serving.
    expect(finalState(S_WS_CLONE, 'peer1')['claim ws-shared']).toMatch(/epoch 1/);
    expect(finalState(S_WS_CLONE, 'peer2')['claim ws-shared']).toBeUndefined();
    expect(steps.some((s) => s.state === 'M3')).toBe(true); // fresh replica advertised (leased)
  });
});
