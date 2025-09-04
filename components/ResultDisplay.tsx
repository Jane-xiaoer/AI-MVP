
import React from 'react';

interface ResultDisplayProps {
  generatedImage: string;
  onReset: () => void;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ generatedImage, onReset }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'ai-art-visualization.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center animate-fade-in">
      <h2 className="text-3xl font-bold text-teal-600 mb-4">Your Visualization is Ready!</h2>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 w-full">
        <img src={generatedImage} alt="AI generated artwork in room" className="w-full h-auto object-contain" />
      </div>
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleDownload}
          className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-6 rounded-full transition-colors duration-300"
        >
          Download Image
        </button>
        <button
          onClick={onReset}
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full transition-colors duration-300"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};