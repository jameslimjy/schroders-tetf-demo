/**
 * Toast Notification Component
 * Displays temporary success/error messages at the center top of the screen
 */

import React, { useEffect, useState } from 'react';
import './Toast.css';

/**
 * Toast Component
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 * @param {function} onClose - Callback when toast is dismissed
 */
export function Toast({ message, type = 'success', duration = 3000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        onClose();
      }
    }, 300); // Match animation duration
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className={`toast toast-${type} ${isLeaving ? 'toast-leaving' : ''}`}
      onClick={handleClose}
    >
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        <button className="toast-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}

/**
 * Toast Container Component
 * Manages multiple toast notifications
 */
export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

