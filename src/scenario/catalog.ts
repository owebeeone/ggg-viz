// The state atlas: every semantic protocol state, named once, reused across
// traces. Ids from the original discovery trace are FROZEN (published); new
// families extend by area:
//   A session/serve basics · B network join/discovery · C subscribe/route
//   D exchanges · E failure paths · F multi-session fan-out · G services
//   W window delivery · H claims/leases · J offline/reconcile · K directory
//   writes · S security stage
import type { CatalogState } from './types';

const STATES: CatalogState[] = [
  // ---- A: session + local serve ----------------------------------------
  { id: 'A1', title: 'session HELLO', frame: 'HELLO', kind: 'message', gateKind: 'security', desc: 'Consumer opens a glade session; principal asserted at HELLO (enforcement seam).' },
  { id: 'A2', title: 'HELLO-ACK / resume', frame: 'HELLO-ACK', kind: 'message', desc: 'Session established; resume state (heads) lives on the session, not the socket.' },
  { id: 'A3', title: 'subscribe (directory)', frame: 'SUBSCRIBE', kind: 'message', desc: 'Consumer registers interest in the home-share directory binding.' },
  { id: 'A4', title: 'fold local replica', frame: 'FOLD', kind: 'internal', desc: 'fold(merge(logs)) over the local replica — offline-first serve.' },
  { id: 'A5', title: 'ops to subscriber', frame: 'OPS', kind: 'message', desc: 'Attributed ops delivered to a subscribing session from the local replica/fold.' },

  // ---- B: network join + peer discovery --------------------------------
  { id: 'B1', title: 'bind iroh endpoint', frame: 'BIND', kind: 'internal', gateKind: 'discovery', desc: 'Node identity = iroh keypair; iroh owns node-id→addr.' },
  { id: 'B2', title: 'publish reachability', frame: 'PUBLISH', kind: 'message', desc: 'pkarr/DNS record + relay under the node key — availability, not authority.' },
  { id: 'B3', title: 'peer set from directory', frame: 'ROUTE', kind: 'internal', desc: 'Known node ids come from the home-share fold (PrincipalDecl/NodeHint), not a registry service.' },
  { id: 'B4', title: 'resolve node id', frame: 'RESOLVE', kind: 'message', desc: 'Only the id→addr question goes to iroh.' },
  { id: 'B5', title: 'NodeAddr answer', frame: 'ADDR', kind: 'message', desc: 'Relay path + direct candidates; hole-punching is iroh’s business.' },
  { id: 'B6', title: 'dial + node HELLO', frame: 'DIAL', kind: 'message', gateKind: 'security', desc: 'Node↔node glade session over iroh — same principal seam as A1, machine-to-machine.' },
  { id: 'B7', title: 'heads exchange', frame: 'HEADS', kind: 'message', desc: 'Version vector + per-log chain heads; anti-entropy starts here (GQ-9).' },
  { id: 'B8', title: 'gap ops (sync)', frame: 'OPS', kind: 'message', desc: 'Missing ops ship both ways; replicas converge by folding the same op-set.' },
  { id: 'B9', title: 'live update to subscriber', frame: 'OPS', kind: 'message', desc: 'Newly replicated ops fan out to existing subscriptions — no re-request.' },

  // ---- C: keyed subscribe + routing to provider ------------------------
  { id: 'C1', title: 'subscribe (keyed resource)', frame: 'SUBSCRIBE', kind: 'message', desc: 'Interest in (share, glade id, key) under a declared shape; keys are canonical CBOR.' },
  { id: 'C2', title: 'route to provider', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: 'ServeClaim lookup in the home-share fold: the share picks the node; the key rides along to pick the stream.' },
  { id: 'C3', title: 'forward interest', frame: 'SUBSCRIBE', kind: 'message', gateKind: 'capability', desc: 'Subscription forwarded to the provider node; capability enforcement point.' },
  { id: 'C4', title: 'authority serves binding', frame: 'PROVIDE', kind: 'internal', desc: 'Authority provider session serves the binding; the node itself never folds for others.' },
  { id: 'C5', title: 'ops from provider', frame: 'OPS', kind: 'message', desc: 'Provider-origin ops return toward the consumer node.' },
  { id: 'C6', title: 'ops forwarded to consumer', frame: 'OPS', kind: 'message', desc: 'Upstream ops forwarded to the subscribing session.' },

  // ---- D: exchanges (directed, never folded) ----------------------------
  { id: 'D1', title: 'exchange request', frame: 'EXCHANGE', kind: 'message', desc: 'Directed typed request (gwz-core RequestMeta rides here); correlation id assigned.' },
  { id: 'D2', title: 'exchange forwarded', frame: 'EXCHANGE', kind: 'message', desc: 'Routed to the claim-holder; exchanges NEVER fan out from caches — 1:1 by correlation.' },
  { id: 'D3', title: 'provider executes', frame: 'PROVIDE', kind: 'internal', desc: 'gwz-core/razel executes the typed request against the working copy (lock held).' },
  { id: 'D4', title: 'exchange response', frame: 'EXCHANGE-RESP', kind: 'message', desc: 'Directed response routes back by correlation id.' },
  { id: 'D5', title: 'response to requester', frame: 'EXCHANGE-RESP', kind: 'message', desc: 'The exchange completes at the requesting session.' },

  // ---- E: failure paths -------------------------------------------------
  { id: 'E1', title: 'subscribe (route will fail)', frame: 'SUBSCRIBE', kind: 'message', desc: 'Same shape as C1 — failure is a property of the route, not the ask.' },
  { id: 'E2', title: 'route: no live claim', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: 'ServeClaim expired at projection time (read-side expiry; never inside the fold).' },
  { id: 'E3', title: 'resolve last host', frame: 'RESOLVE', kind: 'message', desc: 'Chase the last eligible host anyway — maybe only the renewal was missed.' },
  { id: 'E4', title: 'unreachable', frame: 'STATUS', kind: 'message', desc: 'iroh cannot dial what is not there — data, not an exception.' },
  { id: 'E5', title: 'status to consumer', frame: 'STATUS', kind: 'message', desc: 'Timeout/denial surfaced with a reason — appropriate messages, not spinners.' },

  // ---- F: multi-session fan-out -----------------------------------------
  { id: 'F1', title: 'attach to replicated stream', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: 'Stream already replicated on this node: add the session to the subscription table; NO new upstream.' },
  { id: 'F2', title: 'upstream interest refcount', frame: 'ROUTE', kind: 'internal', desc: 'Upstream interest is the union of downstream interests (GDL-002); count changes, connection does not.' },
  { id: 'F3', title: 'retention after zero interest', frame: 'ROUTE', kind: 'internal', desc: 'Last subscriber gone: replica retained per declared retention; upstream interest may drop.' },
  { id: 'F4', title: 'unsubscribe', frame: 'UNSUBSCRIBE', kind: 'message', desc: 'Consumer withdraws interest in (share, glade id, key).' },

  // ---- G: service instantiation (derived bindings) -----------------------
  { id: 'G1', title: 'no provider for derived binding', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: 'No ServeClaim serves a derived binding; a service definition matches it instead.' },
  { id: 'G2', title: 'instantiate service', frame: 'SPAWN', kind: 'internal', desc: 'Ephemeral service instance spawned (a temporary node); placement/lifetime are open design.' },
  { id: 'G3', title: 'service subscribes to sources', frame: 'SUBSCRIBE', kind: 'message', desc: 'The instance is an ordinary session: it subscribes to its source bindings.' },
  { id: 'G4', title: 'service emits derived ops', frame: 'PROVIDE', kind: 'internal', desc: 'The instance is the authority for the derived binding; recomputes on source ops.' },
  { id: 'G5', title: 'service teardown', frame: 'TEARDOWN', kind: 'internal', desc: 'Interest gone: instance retired (refcounted lifetime — open design).' },

  // ---- W: window delivery ------------------------------------------------
  { id: 'W1', title: 'window subscribe', frame: 'SUBSCRIBE', kind: 'message', desc: 'Viewer asks for a window (e.g. lines 3000+100) of a large log/text binding.' },
  { id: 'W2', title: 'priority window serve', frame: 'OPS', kind: 'message', desc: 'The window ships immediately at interactive priority — snappy first paint.' },
  { id: 'W3', title: 'backfill trail', frame: 'OPS', kind: 'message', desc: 'The rest of the log streams at bulk priority behind the window.' },

  // ---- H: claims / leases -------------------------------------------------
  { id: 'H1', title: 'publish serve-claim', frame: 'LEASE', kind: 'internal', desc: 'Node holding the local workspace.lock publishes a leased ServeClaim.' },
  { id: 'H2', title: 'renew lease', frame: 'LEASE', kind: 'internal', desc: 'Claim renewed while the holder is alive.' },
  { id: 'H3', title: 'lease lapses', frame: 'LEASE', kind: 'internal', desc: 'Holder stops renewing (asleep/offline); expiry judged at projection time.' },
  { id: 'H4', title: 'takeover (epoch++)', frame: 'LEASE', kind: 'internal', desc: 'Another eligible host takes the local lock and claims with a higher epoch.' },

  // ---- J: offline / reconcile ----------------------------------------------
  { id: 'J1', title: 'offline local write', frame: 'APPEND', kind: 'internal', desc: 'Ops append to the local destination unconditionally; the network is not on the write path.' },
  { id: 'J2', title: 'conflict surfaced as data', frame: 'OPS', kind: 'message', desc: 'Concurrent writes surface as MV state to the UI (GQ-1) — rendering conflicts is cheap in grip.' },
  { id: 'J3', title: 'append to destination', frame: 'APPEND', kind: 'message', desc: 'Locally appended ops push to the session’s node destination (the wire APPEND frame).' },

  // ---- K: directory writes ---------------------------------------------------
  { id: 'K1', title: 'directory append', frame: 'APPEND', kind: 'internal', desc: 'A WorkspaceEntry/PrincipalDecl/Grant op appended to the home share.' },

  // ---- S: security stage -----------------------------------------------------
  { id: 'S1', title: 'grant issued', frame: 'APPEND', kind: 'internal', desc: 'CapabilityGrant appended under the issuer’s chain.' },
  { id: 'S2', title: 'revocation recorded', frame: 'APPEND', kind: 'internal', desc: 'CapabilityRevocation appended; revocation wins in the fold; forward-only honesty (GDL-009).' },
  { id: 'S3', title: 'enforcement cut', frame: 'STATUS', kind: 'message', gateKind: 'security', desc: 'A live session/stream is cut when its capability disappears — enforcement at every hop.' },
  { id: 'S4', title: 'capability check at fan-out', frame: 'ROUTE', kind: 'internal', gateKind: 'capability', desc: 'Serving from a local replica still requires capability — cached ≠ allowed.' },
  { id: 'S5', title: 'mint attenuated delegation', frame: 'APPEND', kind: 'internal', desc: 'A sponsor signs a narrower chain link for an agent/service: subset of resource+verbs, optional TTL. Narrowing only.' },
  { id: 'S6', title: 'exchange verb check', frame: 'ROUTE', kind: 'internal', gateKind: 'capability', desc: 'The authority evaluates check() for the exchange verb before executing; its local overlay may narrow further.' },
  { id: 'S7', title: 'trust-plug principal bind', frame: 'ROUTE', kind: 'internal', gateKind: 'security', desc: 'The pluggable trust backend (local store, OIDC, AD…) validates authn input and binds the session principal. Authn only — never authorization.' },
  { id: 'S8', title: 'placement check (replica.hold)', frame: 'ROUTE', kind: 'internal', gateKind: 'capability', desc: 'Before a share replicates to a node, the share policy must accept the node’s OPERATOR — placement is a granted verb (AuthzModel §7a).' },
  { id: 'S9', title: 'ancestry check on revocation', frame: 'ROUTE', kind: 'internal', gateKind: 'capability', desc: 'A revocation of an admin chain is valid only if its signer is an ancestor of that chain (or the root). Out-of-ancestry revocations are invalid everywhere and preserved as evidence (AuthzModel §3a).' },

  // ---- Y: replica transmission & verification --------------------------
  { id: 'Y1', title: 'signed checkpoint accepted', frame: 'FOLD', kind: 'internal', desc: 'Compacted history bootstraps from an origin-signed checkpoint; the checkpoint head is ALSO anchored in the home share, so rewrite is fold-detectable (AZ-12 ruling).' },
  { id: 'Y2', title: 'verify-as-ingest', frame: 'FOLD', kind: 'internal', gateKind: 'security', desc: 'Per op: prev-hash continuity in the origin log + origin signature + seq monotonicity. O(1) per op, no whole-share view — carriers are untrusted by construction.' },
  { id: 'Y3', title: 'chain verification failed', frame: 'FOLD', kind: 'internal', gateKind: 'security', desc: 'A tampered op fails the chain check: reject it and its suffix from this peer for this origin; re-fetch from any other replica.' },
  { id: 'Y4', title: 'equivocation evidence', frame: 'APPEND', kind: 'internal', desc: 'Two SIGNED ops for one (origin, seq) slot are a proof of origin fork — recorded as attributable evidence, surfaced to the UI.' },

  // ---- G (cont.): service discovery ------------------------------------
  { id: 'G6', title: 'service instance discovered', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: 'A live ServiceInstanceClaim for this canonical key is found BEFORE definition matching — share the running instance instead of spawning (WD-8 ruling).' },

  // ---- M: replica-set migration -----------------------------------------
  { id: 'M1', title: 'replica hint lapses', frame: 'LEASE', kind: 'internal', desc: 'A ReplicaHint lease horizon passes at the reader’s clock; the replica set is now visibly smaller in the fold.' },
  { id: 'M2', title: 'under-replication repair', frame: 'LEASE', kind: 'internal', gateKind: 'routing', desc: 'Replica count < declared min: the home-node role initiates re-replication (WD-8 ruling); any replica MAY run it idempotently as fallback.' },
  { id: 'M3', title: 'replica hint published', frame: 'LEASE', kind: 'internal', desc: 'A node holding a fresh verified replica advertises it (leased) — feeds nearest-replica routing and repair targeting.' },

  // ---- L: client stack lifecycle (grip · glial · glade) ------------------
  { id: 'L1', title: 'binding declared', frame: 'DECLARE', kind: 'message', desc: 'A tap declares a BindingDecl via glade-decl types; glial receives the declaration. Taps stay thin — no assembly, no sharing code.' },
  { id: 'L2', title: 'glial binds', frame: 'BIND', kind: 'internal', desc: 'Glial attaches destinations: the local store ALWAYS; a glade session only when configuration mounts one (persistence first, glade optional — GDL-035).' },
  { id: 'L3', title: 'app write', frame: 'APPEND', kind: 'message', desc: 'The component sets a value through the tap — a thin conduit to glial.' },
  { id: 'L4', title: 'persist to local store', frame: 'PERSIST', kind: 'internal', desc: 'Glial writes the origin log + cached fold to the browser store (IndexedDB).' },
  { id: 'L5', title: 'hydrate from store', frame: 'HYDRATE', kind: 'internal', desc: 'Boot: glial loads the cached fold + tail from the local destination — the browser is a first-class replica.' },
  { id: 'L6', title: 'rich change event', frame: 'EVENT', kind: 'message', desc: 'Glial emits a shape-aware envelope {refresh|delta, baseSeq} — the consumer chooses incremental vs whole-field against live UI state.' },
  { id: 'L7', title: 'incremental apply', frame: 'EVENT', kind: 'internal', desc: 'The consumer applies the delta; cursors survive via stable position identity (the text-crdt gift).' },
  { id: 'L8', title: 'mount binding instance', frame: 'BIND', kind: 'internal', desc: 'Glial creates a binding INSTANCE (decl + domain/zone/key fill) at mount: refcount 1, its own store destination and fold. Several instances of one app-static decl live at once, each independent (GlialClientRuntime §Boundaries, 2026-07-10).' },
  { id: 'L9', title: 'attach to live instance', frame: 'BIND', kind: 'internal', desc: 'A second consumer mounts the SAME fill: it attaches to the existing instance — refcount bumps with NO new fold and NO new store (s-fanout interest counting, client-side). Mount/unmount is the idiom-agnostic seam; how grip selects the instance never crosses in.' },
  { id: 'L10', title: 'unmount (refcount--)', frame: 'TEARDOWN', kind: 'internal', desc: 'A consumer unmounts: its attachment is dropped and the instance refcount decremented. The instance — its fold and store — is RETAINED while any consumer remains.' },
  { id: 'L11', title: 'instance torn down', frame: 'TEARDOWN', kind: 'internal', desc: 'Refcount reached zero: this instance’s fold and store destination are released. Sibling instances of the same decl (a different fill) are UNAFFECTED — teardown is per-instance.' },

  // ---- N: node boot / system-data seam (GDL-036) -------------------------
  { id: 'N1', title: 'acquire instance', frame: 'FOLD', kind: 'internal', desc: 'StoreApi opens $HOME/.glade/sys/<name>/ and takes instance.lock (single-writer, the workspace.lock precedent); cache/ is class-4, rebuildable, never load-bearing.' },
  { id: 'N2', title: 'node.key → NodeId', frame: 'ROUTE', kind: 'internal', gateKind: 'security', desc: 'Class-1 secret: ssh-discipline permission check (refuse group/world-readable), derive the NodeId, and it MUST match our own NodeRecord in class 2 — key replacement is identity loss, not forgery.' },
  { id: 'N3', title: 'load SystemSnapshot blob', frame: 'HYDRATE', kind: 'internal', desc: 'StoreApi loads records.json as ONE taut SystemSnapshot{records, heads} — a snapshot is a cached fold + heads (degenerate sync). The whole-state blob is the interim impl the seam hides.' },
  { id: 'N4', title: 'class-3 fail-closed load', frame: 'FOLD', kind: 'internal', gateKind: 'security', desc: 'local.json (node-private assertions) is node-self-signed and checked on load; a failed item discards to its declared MOST-restrictive default (AZ-11), never to "off".' },
  { id: 'N5', title: 'RegistryApi ready', frame: 'FOLD', kind: 'internal', desc: 'The materialised fold answers whoServes/replicasOf/grantsFor/nodesOf — reads are queries-over-fold, never getConfig(); a fold-backed impl slots in with no caller changing (the seam test IS the atlas).' },

  // ---- P: app registration / declaration surface (GDL-037/038) -----------
  { id: 'P1', title: 'read <app>.glade', frame: 'FOLD', kind: 'internal', desc: 'A node reads an app’s <app>.glade (e.g. grazel-app.glade) as runtime DATA — loaded, not compiled: BindingDecls + ServiceDefinitions + ACL seeds + WorkspaceEntries parsed. Never a compiler front-end.' },
  { id: 'P2', title: 'register declarations', frame: 'APPEND', kind: 'internal', desc: 'glade ids + shapes + key-type refs registered as ordinary runtime records under the registrant’s chain — the same records dynamic configuration writes; re-registration diffs against records (GQ-6 pinning).' },

  // ---- Z: zones — domain / zone / surface (GDL-039) ----------------------
  { id: 'Z1', title: 'private-zone keyed routing', frame: 'ROUTE', kind: 'internal', desc: 'A private zone is keyed to a self (self:<user>); the subscription table matches (share, glade id, key), so a foreign self never matches — privacy needs NO grant. Contrast S4: commons is the only access-controlled join.' },
  { id: 'Z2', title: 'keyed-commons isolation', frame: 'ROUTE', kind: 'internal', desc: 'A keyed COMMONS surface (a chat group keyed by group id on one glade id) routes by (share, glade id, key): a subscriber to one key never receives another key’s ops. Group isolation is keying — the same mechanism as private zones (Z1), but a shared commons per key. Stage 1 has no per-key grant; stage 2 gates each group join with a membership grant (AZ-16).' },

  // ---- U: identity / onboarding / names (glade-users) --------------------
  { id: 'U1', title: 'mint invite (InviteRecord + token → URL)', frame: 'APPEND', kind: 'internal', desc: 'The inviter mints an InviteRecord (nonce/token, inviter fingerprint, optional target-domain grants-to-be, expiry) and a joinable URL landing on the session-placement bootstrap (GDL-032). An invite NEVER mints identity — it introduces an existing key or invites the recipient to mint one (glade-users §3.1).' },
  { id: 'U2', title: 'accept: present or mint a key', frame: 'HELLO', kind: 'message', gateKind: 'security', desc: 'The recipient opens the invite URL and presents an existing pubkey OR mints a browser device key (root certification can follow later from the CLI root). The principal IS the key (§1.1); the fingerprint is its canonical id.' },
  { id: 'U3', title: 'validate invite (token + signature)', frame: 'PROVIDE', kind: 'internal', gateKind: 'security', desc: 'The glade-users supplier answers the users.invites exchange: token freshness (not replayed, not expired) + signature check. Stage-1 posture is STRUCTURAL — ed25519 verification swaps in behind the seam (§5, same posture as the node).' },
  { id: 'U4', title: 'PrincipalRecord append (fingerprint-keyed)', frame: 'APPEND', kind: 'internal', desc: 'The PrincipalRecord — keyed by FINGERPRINT, carrying the signed profile — appends to dir.principals. The fold key is the fingerprint, so the same key seen by any path set-union-dedups to one principal (§1.1/1.2).' },
  { id: 'U5', title: 'IntroductionRecord append (sponsorship edge)', frame: 'APPEND', kind: 'internal', desc: 'The inviter→invitee sponsorship edge appends to users.introductions. Trust derives from the introduction path (who sponsored whom), never a central authority (§1.3).' },
  { id: 'U6', title: 'fingerprint-keyed convergence (dedup)', frame: 'FOLD', kind: 'internal', desc: 'Every invite path delivers the same pubkey; the principal fold keyed by fingerprint set-union-dedups, so a key introduced via many paths/orders folds to EXACTLY ONE principal on every view (§1.2 — the u1/u2/u3 requirement).' },
  { id: 'U7', title: 'invite rejected — replay/expired (as data)', frame: 'EXCHANGE-RESP', kind: 'message', desc: 'A replayed or expired invite returns ok:false with a reason and mints NO records; the session stays usable. Absence is a value (GladeSupplierModel §2.4) — a bad invite is data, not an exception.' },
  { id: 'U8', title: 'self-assert display name (signed attribute)', frame: 'APPEND', kind: 'internal', desc: 'A display name is a signed, self-asserted attribute on the principal (the key signs its own profile). Anyone can assert any name — so the rendering discipline (U9) is normative, not cosmetic (§2.1).' },
  { id: 'U9', title: 'render name·fp6 (collision discrimination)', frame: 'FOLD', kind: 'internal', desc: 'A bare display name is NEVER shown where principals can collide; the projection renders name·fp6 (first 6 of the fingerprint) unless a petname or scoped handle applies (§2.2).' },
  { id: 'U10', title: 'name claim (users.names registry)', frame: 'APPEND', kind: 'internal', desc: 'A signed claim record for a handle inside a domain’s OPTIONAL users.names registry — ordinary append-only records, not a consensus system (§2.4). Whether this registry is v1 is an open question (§8).' },
  { id: 'U11', title: 'first-valid-claim-wins fold', frame: 'FOLD', kind: 'internal', desc: 'The users.names fold gives the FIRST valid claim the handle (deterministic by chain/lamport order); a later claim for the same handle loses and renders fingerprint-suffixed. Glade’s existing primitives (signed chains, revocation-wins) are all it needs (§2.4).' },
  { id: 'U12', title: 'petname override (viewer-local, account domain)', frame: 'FOLD', kind: 'internal', desc: 'A viewer’s petname for a principal — stored in the viewer’s OWN account domain (AZ-17), never replicated to others — always wins over the self-asserted name, for that viewer alone (§2.3).' },

  // ---- X: workspace hosting / selection / materialization (glade-workspaces) --
  { id: 'X1', title: 'host maps workspace name → gwz root (app-owned)', frame: 'FOLD', kind: 'internal', desc: 'The hosting peer’s composition maps each hosted workspace name to its real gwz root on disk; the mapping is APP-OWNED (the data seam), never rides a request nor is derivable from one (glade-workspaces §1.2, GladeSupplierModel §5).' },
  { id: 'X2', title: 'member enumeration served (ws.members)', frame: 'OPS', kind: 'message', desc: 'The manifest/lock view of a workspace’s member repos (name, path within the workspace, remote, pinned state) served as a surface. A workspace with zero members is legal and enumerates HONESTLY (§1.3 / §2.1, variant .a).' },
  { id: 'X3', title: 'workspace selection (client-context surface)', frame: 'ROUTE', kind: 'internal', desc: 'The client’s selected-workspace surface (ws.selection) is a grip-side value: the AVAILABLE set is the supplier’s directory data, but WHICH one is selected is per-client-context. Tool suppliers (gwz, files, terminal) key off it (§2.1).' },
  { id: 'X4', title: 'selection drives the tool target', frame: 'ROUTE', kind: 'internal', gateKind: 'routing', desc: 'A tool request resolves its target workspace from ws.selection — the selection picks which workspace’s share/root the gwz/files/terminal op addresses (§2.1). The selection surface AS routing input.' },
  { id: 'X5', title: 'materialize on disk (gwz init) — records+disk commit-or-fail', frame: 'PROVIDE', kind: 'internal', desc: 'The create ceremony’s disk leg on the target peer: gwz init (empty workspace, 0 members) and the directory records commit-or-fail TOGETHER; the records are a downstream consequence of disk success (§2.2).' },
  { id: 'X6', title: 'materialization failed — no records minted (as data)', frame: 'PROVIDE', kind: 'internal', desc: 'The disk refuses (path exists / no permission / gwz init fails); the ceremony mints NO WorkspaceEntry and NO ServeClaim, and answers failure as data — the fold is never touched (§2.2, the commit-or-fail-together contract).' },
  { id: 'X7', title: 'clone-from-existing (gwz clone) materialization', frame: 'PROVIDE', kind: 'internal', desc: 'A second peer materializes a workspace via gwz clone semantics from the source; transport is gwz/git remotes (glade carries only the records) — the v1 lean (§2.2 + §7 OQ).' },
  { id: 'X8', title: 'register replica eligibility (join the eligible-host set)', frame: 'APPEND', kind: 'internal', desc: 'The freshly-cloned peer registers eligibility on the existing WorkspaceEntry (adds itself to the eligible hosts) and claims per the lease model; the directory converges to TWO eligible hosts for one workspace — clone is HOW a second host is born (§2.2).' },
];

export const CATALOG: Record<string, CatalogState> = Object.fromEntries(
  STATES.map((s) => [s.id, s]),
);
