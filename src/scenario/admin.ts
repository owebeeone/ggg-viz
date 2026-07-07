// Ownership & administration — the executable side of GladeAuthzModel §3a:
// creation mints the root (no revocable record), admin is a verb-set,
// revocation follows issuance ancestry, and a coup attempt is an invalid op
// preserved as evidence.
import type { Scenario } from './types';
import { pick } from './actors';

const AZ = 'GladeAuthzModel';

export const S_ADMIN: Scenario = {
  id: 's-admin',
  stage: 2,
  title: 'Ownership — creation, delegation, the coup that fails',
  summary: 'user1 creates peerA and is its root (no record to revoke). A delegated owner-admin does routine work, attempts a coup — invalid everywhere, preserved as evidence — and is pruned by the root, subtree and all.',

  actors: pick('gryth1', 'guest1', 'local1', 'peer1'),

  initial: {
    gryth1: { session: 'local1 (open)', role: 'user1 — creator of peerA' },
    guest1: { session: 'local1 (open)', role: 'user2 — soon owner-admin' },
    local1: {
      operator: 'gianni',
      'session gryth1': 'open (gianni root)',
      'session guest1': 'open (guest root)',
      'sub home': 'peer1 (mesh)',
      'grant mallory ws-build': 'read.subscribe (issued by gryth1)',
    },
    peer1: { 'sub home': 'local1 (mesh)', status: 'freshly provisioned — about to be declared' },
  },

  phases: [
    { id: 'AD1', label: 'Creation = root', summary: 'The creator’s admin-ship is structural — there is no record to revoke.' },
    { id: 'AD2', label: 'Delegate + routine admin', summary: 'Owner-admin chain minted; access management is cooperative.' },
    { id: 'AD3', label: 'The coup (invalid)', summary: 'Revoking the root fails ancestry — ignored by every fold, preserved as evidence.' },
    { id: 'AD4', label: 'Root prunes', summary: 'The root revokes the rogue chain; the subtree dies with it.' },
  ],

  steps: [
    {
      state: 'J3', phase: 'AD1', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'declare peerA (creation)',
      payload: { share: 'home', detail: { op: 'NodeRecord{peerA, key → gianni root}', effect: 'creator IS the chain root — no admin grant exists or is needed' } },
      note: 'Creation mints the root, not a grant. What has no record cannot be revoked — the anti-coup property is set here, by construction.',
      docRef: `${AZ} §3a`,
      sets: { gryth1: { 'origin log': '+NodeRecord(peerA)' } },
    },
    {
      state: 'K1', phase: 'AD1', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'fold records the root',
      payload: { share: 'home', detail: { fold: 'peerA: operator/root = gianni' } },
      note: 'Note what the fold does NOT contain: an admin grant for gryth1. Root-ship is structural.',
      docRef: `${AZ} §3a`,
      sets: { local1: { 'node peerA': 'root: gianni (structural)' }, peer1: { 'admin gryth1': 'ROOT (no record — irrevocable)' } },
    },
    {
      state: 'S5', phase: 'AD2', kind: 'internal', from: 'gryth1', frame: 'APPEND',
      label: 'mint owner-admin chain for user2',
      payload: { detail: { chain: 'gianni-root → guest-root', resource: 'peerA', verbs: 'admin.* (incl. admin.delegate)' } },
      note: 'Only chains carrying admin.delegate may mint further admin chains — the meta-right is in-band, a verb like any other.',
      docRef: `${AZ} §3a`,
      sets: { gryth1: { delegations: 'guest1 = owner-admin(peerA)' } },
    },
    {
      state: 'J3', phase: 'AD2', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'admin chain appended',
      payload: { share: 'home', detail: { op: 'CapabilityGrant{subject: guest-root, resource: peerA, verbs: admin.*}' } },
      note: 'Governance is ops in the share, like everything else.',
      sets: { local1: { 'admin guest1 peerA': 'admin.* (via gianni root)' } },
    },
    {
      state: 'B9', phase: 'AD2', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'chain replicates to the subject',
      payload: { share: 'home', detail: { ops: 'CapabilityGrant(guest admin)' } },
      note: 'peerA learns who administers it the way every node learns everything: replication.',
      sets: { peer1: { 'admin guest1': 'admin.* (chain via root)' } },
    },
    {
      state: 'J3', phase: 'AD2', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'routine: user2 revokes a user grant',
      payload: { share: 'home', detail: { op: 'CapabilityRevocation{mallory → ws-build}', issuedBy: 'originally gryth1' } },
      note: 'The governance/access split: admin.revoke over USER-level grants works regardless of issuer — access management is cooperative, reversible in one op, and attributable.',
      docRef: `${AZ} §3a (split)`,
      sets: { guest1: { 'origin log': '+revoke(mallory)' } },
    },
    {
      state: 'S2', phase: 'AD2', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'user grant revoked (valid)',
      payload: { detail: { check: 'admin.revoke ∈ guest chain; target is a USER grant → ancestry not required', fold: 'mallory’s grant deleted' } },
      note: 'A wrongly-removed user is re-granted in one op. This is why the cooperative rule is safe.',
      sets: { local1: { 'grant mallory ws-build': null } },
    },
    {
      state: 'J3', phase: 'AD3', kind: 'message', from: 'guest1', to: 'local1', frame: 'APPEND',
      label: 'THE COUP: user2 "revokes" the creator',
      payload: { share: 'home', detail: { op: 'CapabilityRevocation{target: gianni’s admin-ship over peerA}', problem: 'no such record exists — and guest is not an ancestor of anything gianni holds' } },
      note: 'The bad-actor admin plays their move. It is a syntactically fine op — signed, well-formed, replicable.',
      sets: { guest1: { 'origin log': '+revoke(ROOT?!)' } },
    },
    {
      state: 'S9', phase: 'AD3', kind: 'internal', from: 'local1', frame: 'ROUTE',
      label: 'ancestry check: INVALID',
      payload: { detail: { rule: 'revocation valid iff signer is ancestor of the target chain (or root)', target: 'the root — not a chain, no record', signer: 'guest (not an ancestor of anything gianni holds)', verdict: 'INVALID — excluded from the fold' } },
      gate: { kind: 'capability', label: 'ancestry check on revocation', status: 'enforced', note: 'Validity-filters-before-fold: the coup op is excluded from EVERY fold on EVERY replica, deterministically — there is no node where the coup "worked".' },
      note: 'The op is not deleted — it is preserved as attributable evidence. Coups leave fingerprints.',
      docRef: `${AZ} §3a (anti-coup)`,
      sets: { local1: { evidence: 'coup attempt by guest1 (invalid op, preserved)' } },
    },
    {
      state: 'S3', phase: 'AD3', kind: 'message', from: 'local1', to: 'guest1', frame: 'STATUS',
      label: 'rejected, on the record', response: true,
      payload: { detail: { result: 'revocation invalid', reason: 'signer is not an ancestor of the target; the root has no revocable record' } },
      gate: { kind: 'security', label: 'enforcement cut', status: 'enforced', note: 'Same honest-refusal shape as every other deny — with the twist that this refusal is also evidence.' },
      note: 'peerA’s state is untouched: gryth1 still reads ROOT (no record — irrevocable).',
      docRef: `${AZ} §3a`,
      sets: { guest1: { view: 'revocation rejected (ancestry)' } },
    },
    {
      state: 'J3', phase: 'AD4', kind: 'message', from: 'gryth1', to: 'local1', frame: 'APPEND',
      label: 'root prunes the rogue chain',
      payload: { share: 'home', detail: { op: 'CapabilityRevocation{guest’s admin chain over peerA}', basis: 'signer is the ROOT — ancestor of every chain' } },
      note: 'Valid by ancestry. Anything guest1 delegated dies with this — revoking an admin severs their subtree.',
      docRef: `${AZ} §3a (subtree)`,
      sets: { gryth1: { 'origin log': '+revoke(guest admin)' } },
    },
    {
      state: 'S2', phase: 'AD4', kind: 'internal', from: 'local1', frame: 'APPEND',
      label: 'chain + subtree severed',
      payload: { detail: { fold: 'admin(guest, peerA) deleted; all guest-issued admin chains orphaned' } },
      note: 'Any later admin op signed under the severed chain now fails the same S9 check the coup did.',
      sets: { local1: { 'admin guest1 peerA': null } },
    },
    {
      state: 'B9', phase: 'AD4', kind: 'message', from: 'local1', to: 'peer1', frame: 'OPS',
      label: 'the pruning replicates',
      payload: { share: 'home', detail: { ops: 'CapabilityRevocation(guest admin)' } },
      note: 'Every enforcer converges on the same governance state — replication is the control plane, for governance too.',
      sets: { peer1: { 'admin guest1': null } },
    },
  ],
};
