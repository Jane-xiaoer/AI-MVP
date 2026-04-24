
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { useTranslation } from '../hooks/useTranslation';

interface ImageUploaderProps {
  image: string | null;
  onImageUpload: (base64Image: string) => void;
  isLoading: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ image, onImageUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslation();

  const handleFileChange = useCallback((file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const onButtonClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={`relative w-full aspect-video border border-white/60 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 bg-white/50 ${isDragging ? 'border-white bg-white/70' : 'hover:border-white/90'}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onButtonClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
        disabled={isLoading}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl z-10">
          <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-slate-600"></div>
          <p className="mt-4 text-slate-600">{t('enhancing_space')}</p>
        </div>
      )}
      {image && !isLoading ? (
        <img src={image} alt="Room preview" className="object-contain w-full h-full rounded-2xl" />
      ) : (
        !image && !isLoading && (
          <div className="text-center text-slate-600 p-4 cursor-pointer">
            <UploadIcon />
            <p className="mt-2 font-medium">{t('upload_prompt')}</p>
            <p className="text-sm">{t('upload_formats')}</p>
          </div>
        )
      )}
       {image && isLoading && (
         <img src={image} alt="Room preview" className="object-contain w-full h-full rounded-2xl opacity-30" />
       )}
    </div>
  );
};