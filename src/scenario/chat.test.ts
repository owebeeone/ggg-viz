// s-chat is the executable spec for GLP-0006 P1.S1 (glade-chat, stage 1): the
// supplier DECLARES the surfaces + serves the group list and is OUT of the
// message hot path; two principals post attributed lines into one group's keyed
// commons log; a second group stays isolated by keying; a late joiner folds the
// full history. Stage-1 chat = client appends + node fold/replicate.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { checkInvariants } from './invariants';
import { validateScenario, actorStateAt } from './fold';
import { S_CHAT } from './chat';

const steps = S_CHAT.steps;
const serves = steps.filter((s) => s.frame === 'OPS');
const appends = steps.filter((s) => s.frame === 'APPEND');

describe('s-chat — a supplier declares, clients post', () => {
  it('is a stage-1 trace that validates against the catalog and holds the invariants', () => {
    expect(S_CHAT.stage).toBe(1);
    expect(validateScenario(S_CHAT, CATALOG)).toEqual([]);
    expect(checkInvariants(S_CHAT)).toEqual([]);
  });

  it('the supplier declares the surfaces + serves the group list — and is out of the message hot path', () => {
    // the supplier's only APPENDs are declaration + the chat.groups metadata value.
    const supAppends = appends.filter((s) => s.from === 'chat-sup');
    expect(supAppends.length).toBeGreaterThan(0);
    // it declares chat.msgs (the log) and chat.groups (the value list).
    expect(supAppends.some((s) => /chat\.msgs/.test(JSON.stringify(s.payload)))).toBe(true);
    const groupsServe = supAppends.find((s) => s.payload?.gladeId === 'chat.groups');
    expect(groupsServe?.payload?.shape).toBe('value');
    // CRUCIAL: no message (chat.msgs) line is ever appended BY the supplier —
    // posting is a client append; the supplier is not in the hot path.
    const supMsgAppends = supAppends.filter((s) => s.payload?.gladeId === 'chat.msgs');
    expect(supMsgAppends).toEqual([]);
  });

  it('two distinct principals post into ONE group’s keyed commons log', () => {
    const generalPosts = appends.filter(
      (s) => s.payload?.gladeId === 'chat.msgs' && s.payload?.key === '{group:general}',
    );
    const authors = new Set(generalPosts.map((s) => s.from));
    // alice (gryth1) and bob (guest1) both post into #general.
    expect(authors.has('gryth1')).toBe(true);
    expect(authors.has('guest1')).toBe(true);
    // and both are clients appending (not the supplier).
    expect(authors.has('chat-sup')).toBe(false);
  });

  it('attribution rides EACH line (the ChatLine principal field), never the connection', () => {
    const generalPosts = appends.filter(
      (s) => s.payload?.gladeId === 'chat.msgs' && s.payload?.key === '{group:general}',
    );
    for (const p of generalPosts) {
      // every posted line stamps `principal:` on the ChatLine op.
      expect(JSON.stringify(p.payload)).toMatch(/principal:/);
    }
  });

  it('#general converges for both principals (each folds the other’s line)', () => {
    const toBob = serves.some(
      (s) => s.payload?.gladeId === 'chat.msgs' && s.payload?.key === '{group:general}' && s.to === 'guest1',
    );
    const toAlice = serves.some(
      (s) => s.payload?.gladeId === 'chat.msgs' && s.payload?.key === '{group:general}' && s.to === 'gryth1',
    );
    expect(toBob).toBe(true);
    expect(toAlice).toBe(true);
  });

  it('#dev is isolated: subscribing #general never delivers #dev (keying, no grant)', () => {
    // the isolation is an ungated ROUTE step — group isolation is keying, not permission.
    const z2 = steps.find((s) => s.state === 'Z2')!;
    expect(z2).toBeTruthy();
    expect(z2.frame).toBe('ROUTE');
    expect(z2.gate).toBeUndefined(); // stage-1: no per-key grant exists
    // every #dev serve goes ONLY to a #dev subscriber (bob), never to alice (#general only).
    const devServes = serves.filter(
      (s) => s.payload?.gladeId === 'chat.msgs' && s.payload?.key === '{group:dev}',
    );
    expect(devServes.length).toBeGreaterThan(0);
    for (const s of devServes) expect(s.to).toBe('guest1');
    // alice never subscribed #dev, so she never appears in a #dev subscription entry.
    for (let i = 0; i < steps.length; i++) {
      const fold = actorStateAt(S_CHAT, i).get('local1')!;
      const devSub = fold['sub chat/chat.msgs{dev}'];
      if (devSub) expect(devSub).not.toContain('gryth1');
    }
  });

  it('a late joiner folds the FULL history — the log is the catch-up, no supplier hop', () => {
    // the late #general subscribe is the last {group:general} subscribe in the trace.
    const generalSubs = steps.filter(
      (s) => s.frame === 'SUBSCRIBE' && s.payload?.key?.startsWith('{group:general}'),
    );
    const late = generalSubs[generalSubs.length - 1];
    expect(late.from).toBe('gryth2'); // carol, after alice + bob
    // a FOLD hydration step precedes the catch-up serve, and the serve reaches carol.
    const foldStep = steps.find((s) => s.frame === 'FOLD' && s.state === 'A4');
    expect(foldStep?.payload?.key).toBe('{group:general}');
    const catchup = serves.find(
      (s) => s.to === 'gryth2' && s.payload?.gladeId === 'chat.msgs' && s.payload?.key === '{group:general}',
    );
    expect(catchup).toBeTruthy();
    // the catch-up is served by the node (local1), not the supplier.
    expect(catchup?.from).toBe('local1');
  });
});
