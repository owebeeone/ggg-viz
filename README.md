# ggg-viz — G* protocol trace explorer

A **documentation tool**: an interactive atlas of how the gryth/glade/grazel/
iroh stack behaves — not one diagram, but a **suite of traces** over a shared
pool of actors (3 gryth sessions, 2 local nodes, the iroh plane, 3 peers, and
ephemeral service nodes). Pick a trace from the menu, scrub the slider, watch
messages travel, click anything for its payload, pin a node to see its **live
state fold** (session tables, subscriptions, replicas, claims, grants).

## The model

- **Scenario = data** ([`src/scenario/`](src/scenario/)). Actors, phases,
  steps, payloads, gates, and per-step **state patches** are typed
  declarations. Components project; nothing about any sequence lives in
  component code.
- **The catalog atlas** ([`catalog.ts`](src/scenario/catalog.ts)): every step
  references a globally named protocol state (`A1`, `C2`, `G4`…). Same id ⇒
  same frame/kind/gate everywhere — enforced by tests. Twists are variants
  (`C2.a`) that must declare their difference as data.
- **State is folded, not scripted**: each node's visible state at step *i* is
  a fold of declared patches — the same op-log→fold model the protocol itself
  uses. Temporary actors (service instances) exist only while their folded
  state says `alive`.
- **Invariants** ([`invariants.ts`](src/scenario/invariants.ts)) run over
  every trace at every step: temp-liveness, serving-requires-registered-
  interest (the "cached ≠ allowed" catcher), claim-epoch uniqueness. Traces
  are paths; invariants are the rules no path may break.
- **Two stages**: stage 1 shows the substrate with security seams visible but
  allow-all; stage 2 replays the same catalog states with gates **enforced**
  (HELLO deny, capability at the cached fan-out, revocation mid-subscription).

Traces: discovery golden path · fan-out (second session, same node) · exchange
asymmetry · cross-peer diff via service instantiation · three sessions/two
nodes (replica-of-replica) · window viewer (snappy first paint) · claim
takeover with epoch fencing · offline write + conflict-as-data · workspace
creation · the three stage-2 enforcement traces.

## The graph

[`src/graphviz/`](src/graphviz/) is a **private copy** of gryth-ui's workspace
graph engine (`packages/plugins/workspace/src/graphEngine.ts`), adapted: nodes
are generic sim bodies, `setInput` diffs by id so ephemeral nodes enter/leave
without re-scattering, and content rendering stays in ggg-viz components.
Force-directed, drag-to-anchor, pin-to-expand, RAF loop owned by a tap — no
react state anywhere (the gryth-ui rule, enforced by eslint + scanner).

## The comment loop

The **notes** panel attaches a comment to the exact current view — trace, step
(`C2.a`), focused actor, pinned payload — and a dev-middleware persists it to
[`comments.json`](comments.json) (committed: comments are design artifacts).
Markers appear on the slider and trace rows; clicking a note jumps back to its
captured state. A review session (human or agent) reads the file, discusses the
`open` entries, and replies by editing them (`status: "addressed"` + `reply`) —
the app renders the reply under the note.

## Run

```sh
npm install     # file-links ../grip-core and ../grip-react
npm run dev     # vite (launch.json: ggg-viz, port 5177)
npm test        # no-react-state gate + vitest (folds, atlas, invariants)
npm run lint
```

## Extending

Add steps/traces in `src/scenario/` — reuse catalog states when the protocol
state is genuinely the same, mint new ids when in doubt, mark twists as
variants. The tests keep the atlas honest: unknown states, frame drift,
undeclared variants, interest-free serving, and double-held claims all fail.
When the real glade node grows a diagnostics log shape, this becomes a trace
*replayer* — same folds, recorded ops instead of authored ones — and the
design-vs-reality diff becomes mechanical.
