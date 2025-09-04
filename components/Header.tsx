
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-6xl text-center">
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-gray-600">
        AI Art Interior Designer
      </h1>
      <p className="mt-4 text-lg text-gray-500">
        See how art transforms your space. Upload a room photo, pick an artwork, and let our AI create a stunning preview.
      </p>
    </header>
  );
};