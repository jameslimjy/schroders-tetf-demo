/**
 * Toast Notification Hook
 * Provides a simple way to show toast notifications throughout the app
 */

import { useState, useCallback } from 'react';

let toastIdCounter = 0;

/**
 * Custom hook for managing toast notifications
 * @returns {object} { toasts, showToast, removeToast }
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - 'success' or 'error' (default: 'success')
   * @param {number} duration - Duration in milliseconds (default: 6000)
   */
  const showToast = useCallback((message, type = 'success', duration = 6000) => {
    const id = ++toastIdCounter;
    const newToast = {
      id,
      message,
      type,
      duration,
    };

    setToasts((prevToasts) => [...prevToasts, newToast]);
  }, []);

  /**
   * Remove a toast by ID
   * @param {number} id - The toast ID to remove
   */
  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Show success toast
   * @param {string} message - The success message
   * @param {number} duration - Duration in milliseconds (default: 6000)
   */
  const showSuccess = useCallback((message, duration = 6000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  /**
   * Show error toast
   * @param {string} message - The error message
   * @param {number} duration - Duration in milliseconds (default: 7000)
   */
  const showError = useCallback((message, duration = 7000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    removeToast,
  };
}

