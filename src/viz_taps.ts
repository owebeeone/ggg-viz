import {
  BaseTap,
  createAtomValueTap,
  type Grip,
  type GripContext,
} from '@owebeeone/grip-react';
import { grok } from './runtime';
import { DEFAULT_SCENARIO_ID, SCENARIO_BY_ID } from './scenario';
import {
  activityAt,
  actorStateAt,
  clampStep,
  edgeForStep,
  stepAt,
  traceUpTo,
  visibleActorsAt,
} from './scenario/fold';
import { VizSimTap } from './graphviz/engine';
import {
  ACTIVE_EDGE,
  ACTOR_ACTIVITY,
  ACTOR_STATE,
  CURRENT_SCENARIO,
  CURRENT_STEP,
  FOCUSED_ACTOR,
  FOCUSED_ACTOR_TAP,
  SCENARIO_ID,
  SCENARIO_ID_TAP,
  SELECTED_STEP,
  SELECTED_STEP_TAP,
  STEP_INDEX,
  STEP_INDEX_TAP,
  TRACE,
  VISIBLE_ACTORS,
} from './grips';

export const ScenarioIdTap = createAtomValueTap(SCENARIO_ID, {
  initial: DEFAULT_SCENARIO_ID,
  handleGrip: SCENARIO_ID_TAP,
});

export const StepIndexTap = createAtomValueTap(STEP_INDEX, {
  initial: 0,
  handleGrip: STEP_INDEX_TAP,
});

export const FocusedActorTap = createAtomValueTap(FOCUSED_ACTOR, {
  initial: null,
  handleGrip: FOCUSED_ACTOR_TAP,
});

export const SelectedStepTap = createAtomValueTap(SELECTED_STEP, {
  initial: null,
  handleGrip: SELECTED_STEP_TAP,
});

// Derived state: everything the views need is a fold of (scenario, step).
class VizDerivedTap extends BaseTap {
  constructor() {
    super({
      provides: [
        CURRENT_SCENARIO,
        CURRENT_STEP,
        ACTIVE_EDGE,
        ACTOR_ACTIVITY,
        ACTOR_STATE,
        VISIBLE_ACTORS,
        TRACE,
      ],
      homeParamGrips: [SCENARIO_ID, STEP_INDEX],
    });
  }

  produce(opts?: { destContext?: GripContext }): void {
    const idRaw = this.paramDrips.get(SCENARIO_ID as Grip<unknown>)?.get();
    const scenario = SCENARIO_BY_ID[typeof idRaw === 'string' ? idRaw : DEFAULT_SCENARIO_ID] ?? null;
    const iRaw = this.paramDrips.get(STEP_INDEX as Grip<unknown>)?.get();
    const i = scenario ? clampStep(scenario, typeof iRaw === 'number' ? iRaw : 0) : 0;
    const step = scenario ? stepAt(scenario, i) : null;
    this.publish(
      new Map<Grip<unknown>, unknown>([
        [CURRENT_SCENARIO as Grip<unknown>, scenario],
        [CURRENT_STEP as Grip<unknown>, step ?? null],
        [ACTIVE_EDGE as Grip<unknown>, step ? edgeForStep(step) : null],
        [ACTOR_ACTIVITY as Grip<unknown>, scenario ? activityAt(scenario, i) : new Map()],
        [ACTOR_STATE as Grip<unknown>, scenario ? actorStateAt(scenario, i) : new Map()],
        [VISIBLE_ACTORS as Grip<unknown>, scenario ? visibleActorsAt(scenario, i) : []],
        [TRACE as Grip<unknown>, scenario ? traceUpTo(scenario, i) : []],
      ]),
      opts?.destContext,
    );
  }

  produceOnParams(): void {
    this.produce();
  }

  produceOnDestParams(): void {}
}

export const VizDerived = new VizDerivedTap();
export const VizSim = new VizSimTap();

export function registerAllTaps() {
  grok.registerTap(ScenarioIdTap);
  grok.registerTap(StepIndexTap);
  grok.registerTap(FocusedActorTap);
  grok.registerTap(SelectedStepTap);
  grok.registerTap(VizDerived);
  grok.registerTap(VizSim);
}
