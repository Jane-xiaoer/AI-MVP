
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface ImageUploaderProps {
  image: string | null;
  onImageUpload: (base64Image: string) => void;
  isLoading: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ image, onImageUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      className={`relative w-full aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300 ${isDragging ? 'border-teal-400 bg-teal-50' : 'border-gray-300 hover:border-teal-400 bg-white'}`}
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
        <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center rounded-xl z-10">
          <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-teal-500"></div>
          <p className="mt-4 text-gray-600">Creating design rendering...</p>
        </div>
      )}
      {image && !isLoading ? (
        <img src={image} alt="Room preview" className="object-contain w-full h-full rounded-lg" />
      ) : (
        !image && !isLoading && (
          <div className="text-center text-gray-500 p-4 cursor-pointer">
            <UploadIcon />
            <p className="mt-2 font-semibold">Click to upload or drag & drop</p>
            <p className="text-sm">PNG, JPG, WEBP recommended</p>
          </div>
        )
      )}
       {image && isLoading && (
         <img src={image} alt="Room preview" className="object-contain w-full h-full rounded-lg opacity-30" />
       )}
    </div>
  );
};