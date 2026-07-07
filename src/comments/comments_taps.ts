import { createAtomValueTap } from '@owebeeone/grip-react';
import type { AtomTapHandle } from '@owebeeone/grip-react';
import { defineGrip, grok } from '../runtime';
import type { NewComment, TraceComment } from './types';

export const COMMENTS = defineGrip<readonly TraceComment[]>('Viz.Comments', []);
export const COMMENTS_TAP = defineGrip<AtomTapHandle<readonly TraceComment[]>>('Viz.Comments.Tap');

export const CommentsTap = createAtomValueTap(COMMENTS, {
  initial: [] as readonly TraceComment[],
  handleGrip: COMMENTS_TAP,
});

// Async producer side (the openmeteo pattern): fetch → tap.set. Components
// only ever read the grip and call addComment from handlers.
export async function loadComments(): Promise<void> {
  try {
    const res = await fetch('/api/comments');
    if (res.ok) CommentsTap.set((await res.json()) as TraceComment[]);
  } catch {
    // dev server without the middleware (e.g. vite preview) — stay empty
  }
}

export async function addComment(c: NewComment): Promise<void> {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(c),
  });
  if (res.ok) CommentsTap.set((await res.json()) as TraceComment[]);
}

export function registerCommentTaps() {
  grok.registerTap(CommentsTap);
  void loadComments();
}
