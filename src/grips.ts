import type { AtomTapHandle } from '@owebeeone/grip-react';
import { defineGrip } from './runtime';
import type { Scenario, Step } from './scenario/types';
import type { ActorState, Activity, Edge } from './scenario/fold';

// User-driven state.
export const SCENARIO_ID = defineGrip<string>('Viz.ScenarioId');
export const SCENARIO_ID_TAP = defineGrip<AtomTapHandle<string>>('Viz.ScenarioId.Tap');

export const STEP_INDEX = defineGrip<number>('Viz.StepIndex', 0);
export const STEP_INDEX_TAP = defineGrip<AtomTapHandle<number>>('Viz.StepIndex.Tap');

export const FOCUSED_ACTOR = defineGrip<string | null>('Viz.FocusedActor', null);
export const FOCUSED_ACTOR_TAP = defineGrip<AtomTapHandle<string | null>>('Viz.FocusedActor.Tap');

// A pinned step INDEX for the payload panel; null = follow the slider.
export const SELECTED_STEP = defineGrip<number | null>('Viz.SelectedStep', null);
export const SELECTED_STEP_TAP = defineGrip<AtomTapHandle<number | null>>('Viz.SelectedStep.Tap');

// Derived by VizDerivedTap (folds over the registry) — consumers stay thin.
export const CURRENT_SCENARIO = defineGrip<Scenario | null>('Viz.CurrentScenario', null);
export const CURRENT_STEP = defineGrip<Step | null>('Viz.CurrentStep', null);
export const ACTIVE_EDGE = defineGrip<Edge | null>('Viz.ActiveEdge', null);
export const ACTOR_ACTIVITY = defineGrip<ReadonlyMap<string, Activity>>(
  'Viz.ActorActivity',
  new Map(),
);
export const ACTOR_STATE = defineGrip<ActorState>('Viz.ActorState', new Map());
export const VISIBLE_ACTORS = defineGrip<readonly string[]>('Viz.VisibleActors', []);
export const TRACE = defineGrip<readonly Step[]>('Viz.Trace', []);
