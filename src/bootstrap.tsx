import './index.css';
import { GripProvider } from '@owebeeone/grip-react';
import ReactDOM from 'react-dom/client';
import { grok, main } from './runtime';
import { registerAllTaps } from './viz_taps';
import { registerCommentTaps } from './comments/comments_taps';
import App from './App';

registerAllTaps();
registerCommentTaps();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <GripProvider grok={grok} context={main}>
    <App />
  </GripProvider>,
);
