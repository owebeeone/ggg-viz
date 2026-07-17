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
import { S_STACK_CONNECT, S_STACK_LOCAL, S_STACK_MULTI } from './stack';
import { S_BOOT } from './boot';
import { S_APP_REGISTER } from './register';
import { S_ZONES } from './zones';
import { S_CHAT, S_CHAT_CREATE, S_CHAT_QUOTA, S_CHAT_DECL_REALNODE, S_CHAT_EDIT, S_CHAT_CODEC } from './chat';
import {
  S_INVITE,
  S_NAME_CLASH,
  S_CONVERGE_IDENTITY,
  S_INVITE_ROOT,
  S_DEVICE_CERT,
  S_SIGNED_GOV_DENY,
} from './users';
import {
  S_WS_HOST,
  S_WS_CREATE,
  S_WS_CLONE,
  S_WS_SELECT_BY_ID,
  S_WS_CREATE_DURABLE,
  S_WS_CREATE_RECOVER,
  S_WS_CLONE_ORSET,
} from './workspaces';
import { S_ATTACH_AUTHN, S_SELF_KEY_BIND, S_SIGNED_OP } from './security';
import {
  S_GWZ_STATUS,
  S_GWZ_DTO_PROJECT,
  S_GWZ_STREAM,
  S_GWZ_TAG_EGRESS,
  S_GWZ_CREATE_RECOVER,
  S_GWZ_REQUESTER_CTX,
  S_GWZ_COMPOSE_READONLY,
  S_GWZ_PUSH_DENY,
} from './gwz';
import {
  S_DIFF_AUTHZ,
  S_DIFF_GENERATION,
  S_DIFF_SANDBOX_DENY,
  S_DIFF_REVOKE_MIDSTREAM,
} from './diff';
import { S_FILE_WINDOW, S_BLOB_FETCH, S_FILE_WRITE, S_TREE_SUBTREE } from './files';
import { S_TERM_REATTACH, S_TERM_TAKEOVER, S_TERM_REMOTE_DENIED } from './terminal';
import {
  S_EDIT_CRDT,
  S_EDIT_CURSOR,
  S_EDIT_OFFLINE_MERGE,
  S_EDIT_SAVE_CONFLICT,
  S_EDIT_COMPACTION,
} from './editing';
import { S_SHARE_CREATE, S_SHARE_INVITE, S_SHARE_REVOKE, S_KNOCK_DIRECTED, S_LINK_SHARE } from './share';

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
  S_CHAT,
  S_CHAT_CODEC,
  // gwz workspace app — stage-1 surfaces (status/DTO/stream/tag/create/ctx/compose)
  S_GWZ_STATUS,
  S_GWZ_DTO_PROJECT,
  S_GWZ_STREAM,
  S_GWZ_TAG_EGRESS,
  S_GWZ_CREATE_RECOVER,
  S_GWZ_REQUESTER_CTX,
  S_GWZ_COMPOSE_READONLY,
  // files — windowed reads, blob refs, writes
  S_FILE_WINDOW,
  S_BLOB_FETCH,
  S_FILE_WRITE,
  // terminal — attach/takeover semantics
  S_TERM_REATTACH,
  S_TERM_TAKEOVER,
  S_TERM_REMOTE_DENIED,
  // editing — CRDT convergence, cursors, offline merge, compaction
  S_EDIT_CRDT,
  S_EDIT_CURSOR,
  S_EDIT_OFFLINE_MERGE,
  S_EDIT_SAVE_CONFLICT,
  S_EDIT_COMPACTION,
  // share — create / invite / link (stage-1 arms)
  S_SHARE_CREATE,
  S_SHARE_INVITE,
  S_LINK_SHARE,
  // GLP-0006 spine — glade-users (identity) + glade-workspaces (hosting)
  S_INVITE,
  S_NAME_CLASH,
  S_CONVERGE_IDENTITY,
  S_INVITE_ROOT,
  S_DEVICE_CERT,
  S_WS_HOST,
  S_WS_CREATE,
  S_WS_CLONE,
  S_WS_SELECT_BY_ID,
  S_WS_CREATE_DURABLE,
  S_WS_CREATE_RECOVER,
  S_WS_CLONE_ORSET,
  // stage 2 — security enforced on the same states
  S_SEC_HELLO,
  S_SEC_FANOUT,
  S_SEC_REVOKE,
  S_ATTACH_AUTHN,
  S_SELF_KEY_BIND,
  S_SIGNED_OP,
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
  // glade-diff — derived-surface authz (INV-7), generation state, sandbox, revoke
  S_DIFF_AUTHZ,
  S_DIFF_GENERATION,
  S_DIFF_SANDBOX_DENY,
  S_DIFF_REVOKE_MIDSTREAM,
  // stage-2 arms of the app clusters
  S_GWZ_PUSH_DENY,
  S_TREE_SUBTREE,
  S_CHAT_CREATE,
  S_CHAT_QUOTA,
  S_CHAT_DECL_REALNODE,
  S_CHAT_EDIT,
  S_SIGNED_GOV_DENY,
  S_SHARE_REVOKE,
  S_KNOCK_DIRECTED,
  // stage 3 — the stack page (grip · glial · glade)
  S_STACK_LOCAL,
  S_STACK_CONNECT,
  S_STACK_MULTI,
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

export const DEFAULT_SCENARIO_ID = DISCOVERY.id;
