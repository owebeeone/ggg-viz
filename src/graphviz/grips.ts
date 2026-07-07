import { defineGrip } from '../runtime';
import type { VizGraphEngine, VizRenderNode } from './engine';

// Published by the sim tap: live node geometry + the engine (gesture surface).
export const VIZ_GRAPH_NODES = defineGrip<VizRenderNode[]>('Viz.GraphNodes', []);
export const VIZ_GRAPH_ENGINE = defineGrip<VizGraphEngine>('Viz.GraphEngine');
