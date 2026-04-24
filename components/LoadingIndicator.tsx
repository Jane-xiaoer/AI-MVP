

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface LoadingIndicatorProps {
  steps: string[];
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ steps, message }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const t = useTranslation();

  useEffect(() => {
    if (steps.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStepIndex((prevIndex) => (prevIndex + 1) % steps.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [steps]);

  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-slate-600"></div>
      <h2 className="font-serif text-3xl font-bold text-slate-800 mt-6">{t('generating_title')}</h2>
      <p className="text-slate-600 mt-2 text-lg transition-opacity duration-500 h-6">
        {steps[currentStepIndex]}
      </p>
      {message && (
        <p className="text-slate-500 mt-6 text-sm whitespace-nowrap">
          {message}
        </p>
      )}
    </div>
  );
};