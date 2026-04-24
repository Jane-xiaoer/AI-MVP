
import React, { useRef, useCallback, useState } from 'react';
import type { Artwork } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { XIcon } from './icons/XIcon';
import { useTranslation } from '../hooks/useTranslation';

interface ArtGalleryProps {
  artwork: Artwork | null;
  onArtUpload: (base64Image: string) => void;
  onRemoveArt: () => void;
  canUpload: boolean;
}

export const ArtGallery: React.FC<ArtGalleryProps> = ({ 
  artwork, 
  onArtUpload, 
  onRemoveArt,
  canUpload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const t = useTranslation();

  const handleFileChange = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFile = Array.from(files).find(file => file.type.startsWith('image/'));
    if (!imageFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onArtUpload(reader.result as string);
    };
    reader.readAsDataURL(imageFile);
    
  }, [onArtUpload]);

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
    }
  };

  const handleUploadClick = () => {
    if (canUpload) {
      fileInputRef.current?.click();
    }
  };
  
  return (
    <div 
      className="w-full h-full flex flex-col space-y-3 p-1 bg-transparent rounded-lg"
      onDragEnter={canUpload ? onDragEnter : undefined}
      onDragLeave={canUpload ? onDragLeave : undefined}
      onDragOver={canUpload ? onDragOver : undefined}
      onDrop={canUpload ? onDrop : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!canUpload}
        onChange={(e) => {
          handleFileChange(e.target.files);
          if(e.target) e.target.value = '';
        }}
      />
      {!artwork ? (
        <div 
          className={`w-full h-full flex-grow border border-white/60 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${!canUpload ? 'bg-white/30 cursor-not-allowed opacity-70' : `cursor-pointer ${isDragging ? 'border-white bg-white/70' : 'hover:border-white/90 bg-white/50'}`}`}
          onClick={handleUploadClick}
        >
          <div className="text-center text-slate-600 p-4">
              <UploadIcon />
              <p className="mt-2 font-medium">{t('upload_artwork_prompt')}</p>
              <p className="text-sm">{t('upload_formats')}</p>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center p-4">
            <div className="relative group w-3/4 max-w-[200px] aspect-square">
                <img src={artwork.imageUrl} alt={artwork.title} className="w-full h-full object-contain rounded-lg shadow-md" />
                <button 
                    onClick={onRemoveArt}
                    className="absolute -top-2 -right-2 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
                    aria-label="Remove image"
                >
                    <XIcon className="w-5 h-5 text-slate-800" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
