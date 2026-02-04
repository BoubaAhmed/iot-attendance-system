import React from 'react';
import { FiLoader } from 'react-icons/fi';

const LoadingSpinner = ({
  message = 'Chargement...',
  sub = '',
  compact = false,
  className = ''
}) => {
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
        <div className="w-4 h-4 rounded-full bg-transparent p-[2px] animate-spin-slow">
          <div className="w-full h-full rounded-full flex items-center justify-center">
            <FiLoader className="w-3 h-3 text-primary-dark animate-pulse" />
          </div>
        </div>
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center px-4 ${className}`} role="status" aria-live="polite">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-transparent p-1 animate-spin-slow">
          <div className="rounded-full w-full h-full flex items-center justify-center shadow-sm">
            <FiLoader className="h-7 w-7 text-primary-dark animate-pulse" />
          </div>
        </div>
      </div>
      {message && <p className="mt-4 text-primary-dark font-medium">{message}</p>}
      {sub && <p className="text-sm text-primary-dark/70 mt-2">{sub}</p>}
    </div>
  );
};

export default LoadingSpinner;
