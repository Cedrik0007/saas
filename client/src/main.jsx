import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Remove tooltips (title attributes and pattern attributes) from all input fields
const removeInputTooltips = () => {
  const inputs = document.querySelectorAll('input[title], select[title], textarea[title], input[pattern], select[pattern], textarea[pattern]');
  inputs.forEach((input) => {
    input.removeAttribute('title');
    input.removeAttribute('pattern');
  });
};

// Prevent browser validation tooltips globally
const preventValidationTooltips = () => {
  // Add onInvalid handler to all required inputs to prevent default tooltips
  const addInvalidHandlers = () => {
    const inputs = document.querySelectorAll('input[required], select[required], textarea[required]');
    inputs.forEach((input) => {
      if (!input.hasAttribute('data-invalid-handler-added')) {
        input.addEventListener('invalid', (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, { capture: true });
        input.setAttribute('data-invalid-handler-added', 'true');
      }
    });
  };

  // Run on initial load
  addInvalidHandlers();

  // Use MutationObserver to add handlers to dynamically added inputs
  const observer = new MutationObserver(() => {
    removeInputTooltips();
    addInvalidHandlers();
  });

  // Start observing when DOM is ready
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'required', 'pattern']
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title', 'required', 'pattern']
      });
    });
  }
};

// Run on initial load
removeInputTooltips();
preventValidationTooltips();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);


























