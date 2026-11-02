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
            background: 'rgba(0,31,25,0.96)',
            border: '1px solid rgba(168,230,0,0.22)',
            color: '#F7F7EF',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);
