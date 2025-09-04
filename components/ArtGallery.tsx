
import React, { useRef, useCallback } from 'react';
import type { Artwork } from '../types';
import { UploadIcon } from './icons/UploadIcon';

interface ArtGalleryProps {
  artworks: Artwork[];
  selectedArtId?: number | string | null;
  onArtSelect: (artwork: Artwork) => void;
  onUserArtUpload: (base64Image: string) => void;
}

export const ArtGallery: React.FC<ArtGalleryProps> = ({ artworks, selectedArtId, onArtSelect, onUserArtUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUserArtUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onUserArtUpload]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white border border-gray-300 rounded-xl p-4 w-full h-[300px] md:h-full overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Upload Card */}
        <div
          onClick={handleUploadClick}
          className="relative rounded-lg overflow-hidden cursor-pointer group transform hover:scale-105 transition-transform duration-300 border-2 border-dashed border-gray-400 hover:border-teal-500 flex flex-col items-center justify-center text-gray-500 hover:text-teal-500 aspect-square"
        >
          <UploadIcon />
          <p className="mt-1 text-xs font-semibold text-center px-1">Upload Your Art</p>
        </div>

        {/* Gallery Items */}
        {artworks.map((art) => (
          <div
            key={art.id}
            className={`relative rounded-lg overflow-hidden cursor-pointer group transform hover:scale-105 transition-transform duration-300 ${selectedArtId === art.id ? 'ring-4 ring-offset-2 ring-teal-500' : ''}`}
            onClick={() => onArtSelect(art)}
          >
            <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover aspect-square" />
            <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-20 transition-all duration-300 flex items-end p-2">
              <p className="text-white text-xs font-semibold">{art.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};