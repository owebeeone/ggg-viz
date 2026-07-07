// A comment anchored to a precise protocol-state view: which trace, which
// step, what was focused/pinned when the thought occurred. Persisted to
// ggg-viz/comments.json via the dev-server middleware so review sessions
// (human or agent) can read the queue and reply.
export interface TraceComment {
  id: string; // server-assigned
  at: string; // ISO timestamp, server-assigned
  status: 'open' | 'addressed';
  scenarioId: string;
  stepIndex: number;
  stepId: string; // rendered catalog id at capture time, e.g. 'C2.a'
  phase: string;
  focusedActor: string | null;
  pinnedStep: number | null;
  text: string;
  reply?: string; // filled when addressed
}

// What the client sends; id/at/status are the server's.
export type NewComment = Omit<TraceComment, 'id' | 'at' | 'status' | 'reply'>;
