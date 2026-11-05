import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root was not found in the document.');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(1,38,27,0.96)',
            border: '1px solid rgba(158,219,2,0.24)',
            color: '#f6f5ea',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);
