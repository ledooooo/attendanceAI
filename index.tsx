
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const renderApp = () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      console.error("Could not find root element with id 'root'");
      return;
    }

    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("React app rendered successfully.");
  } catch (error) {
    console.error("Failed to render React app:", error);
    const rootElement = document.getElementById('root');
    if (rootElement) {
        rootElement.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">
            <h2>حدث خطأ أثناء تحميل التطبيق</h2>
            <p>${error instanceof Error ? error.message : "خطأ غير معروف"}</p>
            <button onclick="location.reload()" style="padding: 10px 20px; cursor: pointer;">إعادة المحاولة</button>
        </div>`;
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
