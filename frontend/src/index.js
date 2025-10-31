import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// React 18+ API: ReactDOM.render() was removed in React 19
// Must use createRoot() instead
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
