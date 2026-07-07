// The trace registry: stage 1 = allow-all substrate, stage 2 = gates enforced.
import type { Scenario } from './types';
import { DISCOVERY } from './discovery';
import { S_FANOUT, S_FANOUT_X } from './fanout';
import { S_DIFF } from './services';
import { S_3UI2N } from './topology';
import { S_WINDOW } from './window';
import { S_CREATE, S_OFFLINE, S_TAKEOVER } from './lifecycle';
import { S_SEC_FANOUT, S_SEC_HELLO, S_SEC_REVOKE } from './security';
import { S_AGENT, S_GRANT, S_IDP, S_VERBS } from './authz';
import { S_LOCAL_GUEST, S_ROAM, S_TENANT } from './operators';
import { S_ADMIN } from './admin';
import { S_MIGRATE, S_SVC_SHARED, S_SYNC } from './sync';
import { S_STACK_CONNECT, S_STACK_LOCAL } from './stack';
import { S_BOOT } from './boot';
import { S_APP_REGISTER } from './register';
import { S_ZONES } from './zones';

export const SCENARIOS: Scenario[] = [
  // stage 1 — substrate (allow-all, seams visible)
  DISCOVERY,
  S_BOOT,
  S_APP_REGISTER,
  S_FANOUT,
  S_FANOUT_X,
  S_DIFF,
  S_3UI2N,
  S_WINDOW,
  S_TAKEOVER,
  S_OFFLINE,
  S_CREATE,
  // stage 2 — security enforced on the same states
  S_SEC_HELLO,
  S_SEC_FANOUT,
  S_SEC_REVOKE,
  S_GRANT,
  S_AGENT,
  S_VERBS,
  S_IDP,
  S_ZONES,
  S_ROAM,
  S_TENANT,
  S_LOCAL_GUEST,
  S_ADMIN,
  S_SYNC,
  S_SVC_SHARED,
  S_MIGRATE,
  // stage 3 — the stack page (grip · glial · glade)
  S_STACK_LOCAL,
  S_STACK_CONNECT,
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

export const DEFAULT_SCENARIO_ID = DISCOVERY.id;
