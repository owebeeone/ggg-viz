import { useGrip } from '@owebeeone/grip-react';
import { CURRENT_SCENARIO } from './grips';
import ScenarioMenu from './components/ScenarioMenu';
import GraphHost from './components/GraphHost';
import PhaseBar from './components/PhaseBar';
import StepSlider from './components/StepSlider';
import PayloadPanel from './components/PayloadPanel';
import TraceLog from './components/TraceLog';
import CommentsPanel from './components/CommentsPanel';

export default function App() {
  const scenario = useGrip(CURRENT_SCENARIO);
  return (
    <div className="app">
      <header className="app-head">
        <h1>ggg-viz</h1>
        <p className="scenario-title">
          {scenario ? `${scenario.title} — ${scenario.summary}` : ''}
        </p>
      </header>
      <div className="main">
        <ScenarioMenu />
        <div className="stage">
          <PhaseBar />
          <GraphHost />
          <StepSlider />
          <div className="legend">
            <span className="lg lg-req">request</span>
            <span className="lg lg-resp">response</span>
            <span className="lg lg-gate">⛩ gate (stub / designed / enforced / open)</span>
            <span className="lg lg-temp">⬡ ephemeral service</span>
          </div>
        </div>
        <div className="side">
          <PayloadPanel />
          <CommentsPanel />
          <TraceLog />
        </div>
      </div>
    </div>
  );
}
