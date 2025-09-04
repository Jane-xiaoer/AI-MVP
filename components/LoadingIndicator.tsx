
import React, { useState, useEffect } from 'react';

interface LoadingIndicatorProps {
  steps: string[];
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ steps }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prevIndex) => (prevIndex + 1) % steps.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-teal-500"></div>
      <h2 className="text-2xl font-semibold mt-6 text-gray-700">AI Agent at Work...</h2>
      <p className="text-gray-500 mt-2 text-lg transition-opacity duration-500">
        {steps[currentStepIndex]}
      </p>
    </div>
  );
};