/**
 * Toast Context
 * Provides toast notification functionality to all components
 */

import React, { createContext, useContext } from 'react';
import { useToast } from '../hooks/useToast';

const ToastContext = createContext(null);

/**
 * Toast Provider Component
 * Wraps the app and provides toast functionality
 */
export function ToastProvider({ children }) {
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast context
 * @returns {object} { toasts, showToast, showSuccess, showError, removeToast }
 */
export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
}

