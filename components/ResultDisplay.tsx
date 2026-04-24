
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { CompareIcon } from './icons/CompareIcon';
import { BrushIcon } from './icons/BrushIcon';
import { XIcon } from './icons/XIcon';
import type { EditOptions } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { LanguageContext } from '../context/LanguageContext';
import { framingOptions } from '../locales';


type LocalEditOptions = Omit<EditOptions, 'baseImage' | 'apiKey' | 'textPrompt' | 'maskImage' | 'newArtworkImage'>;

interface ResultDisplayProps {
  baseImage: string;
  editedImage: string;
  onReset: () => void;
  onEdit: (options: Omit<EditOptions, 'baseImage' | 'apiKey'>) => Promise<void>;
  isLoading: boolean;
  onUndo: () => void;
  canUndo: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ baseImage, editedImage, onReset, onEdit, isLoading, onUndo, canUndo }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { language } = useContext(LanguageContext);
  const t = useTranslation();

  // New state for edit controls
  const [editText, setEditText] = useState('');
  const [localEditOptions, setLocalEditOptions] = useState<LocalEditOptions>({});
  const [newArtwork, setNewArtwork] = useState<string | null>(null);
  const newArtInputRef = useRef<HTMLInputElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);

  // Reset slider and edit options when images change
  useEffect(() => {
    setSliderPosition(50);
    setLocalEditOptions({});
    setEditText('');
    setMaskImage(null);
    setIsDrawing(false);
    setNewArtwork(null);
  }, [editedImage]);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let newPosition = (x / rect.width) * 100;
    if (newPosition < 0) newPosition = 0;
    if (newPosition > 100) newPosition = 100;
    setSliderPosition(newPosition);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleMove(e.clientX);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => isDragging && handleMove(e.clientX);
    
    const handleTouchEnd = () => setIsDragging(false);
    const handleTouchMove = (e: TouchEvent) => isDragging && handleMove(e.touches[0].clientX);

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, handleMove]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = editedImage;
    link.download = 'ai-art-visualization.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewArtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewArtwork(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = ''; // Allow re-uploading same file
  };

  // Edit handlers
  const handleRegenerate = () => {
    const finalOptions = {
      ...localEditOptions,
      textPrompt: editText || undefined,
      maskImage: maskImage || undefined,
      newArtworkImage: newArtwork || undefined,
    };
    onEdit(finalOptions);
  };
  
  // Canvas drawing logic
  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const imageWidth = canvas.width;
    const imageHeight = canvas.height;

    const containerRatio = containerWidth / containerHeight;
    const imageRatio = imageWidth / imageHeight;

    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (imageRatio > containerRatio) {
        // Image is wider than container, letterboxed vertically
        renderedWidth = containerWidth;
        renderedHeight = containerWidth / imageRatio;
        offsetX = 0;
        offsetY = (containerHeight - renderedHeight) / 2;
    } else {
        // Image is taller than or same as container, letterboxed horizontally
        renderedHeight = containerHeight;
        renderedWidth = containerHeight * imageRatio;
        offsetY = 0;
        offsetX = (containerWidth - renderedWidth) / 2;
    }

    const mouseX = clientX - rect.left - offsetX;
    const mouseY = clientY - rect.top - offsetY;

    // Check if the cursor is outside the visible image area
    if (mouseX < 0 || mouseX > renderedWidth || mouseY < 0 || mouseY > renderedHeight) {
      return null;
    }
    
    // Scale mouse position to canvas resolution
    const canvasX = (mouseX / renderedWidth) * imageWidth;
    const canvasY = (mouseY / renderedHeight) * imageHeight;
    
    return { x: canvasX, y: canvasY };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialPos = getCanvasPos(e);
    if (!initialPos) return; // Do not start drawing if the click is outside the image

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineCap = 'round';
    ctx.lineWidth = 30; // Increased brush size
    ctx.strokeStyle = 'white';
    
    ctx.beginPath();
    ctx.moveTo(initialPos.x, initialPos.y);

    const draw = (eMove: MouseEvent | TouchEvent) => {
      const movePos = getCanvasPos(eMove);
      if (movePos) { // Only draw if the cursor is over the image
        ctx.lineTo(movePos.x, movePos.y);
        ctx.stroke();
      }
    };

    const stopDrawing = () => {
      ctx.beginPath(); // Reset the path to prevent connecting strokes on next draw
      canvas.removeEventListener('mousemove', draw as EventListener);
      canvas.removeEventListener('touchmove', draw as EventListener);
      window.removeEventListener('mouseup', stopDrawing);
      window.removeEventListener('touchend', stopDrawing);
    };

    canvas.addEventListener('mousemove', draw as EventListener);
    canvas.addEventListener('touchmove', draw as EventListener);
    window.addEventListener('mouseup', stopDrawing);
    window.addEventListener('touchend', stopDrawing);
  }, [getCanvasPos]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  const finishDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskCtx.drawImage(canvas, 0, 0);
      setMaskImage(maskCanvas.toDataURL('image/png'));
    }
    
    setIsDrawing(false);
  };

  const toggleDrawing = () => {
    if (isDrawing) {
      finishDrawing();
    } else {
      setIsDrawing(true);
      setMaskImage(null);
      setTimeout(() => {
         const canvas = canvasRef.current;
         const img = containerRef.current?.querySelector('img');
         if (canvas && img) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            clearCanvas();
         }
      }, 0);
    }
  }
  
  const hasEdits = Object.keys(localEditOptions).length > 0 || editText.trim() !== '' || newArtwork !== null;

  return (
    <div className="w-full max-w-4xl flex flex-col items-center animate-fade-in">
      
      <div className="relative w-full mb-6">
        <div 
          ref={containerRef}
          className="relative w-full aspect-video bg-white/30 rounded-2xl shadow-2xl overflow-hidden border border-white/50 select-none"
          style={{ cursor: isDrawing ? 'auto' : 'ew-resize' }}
          onMouseDown={!isDrawing ? handleMouseDown : undefined}
          onTouchStart={!isDrawing ? handleTouchStart : undefined}
        >
          <img 
              src={baseImage} 
              alt="Base room" 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable="false" 
          />
          <div 
              className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
              <img 
                  src={editedImage} 
                  alt="AI edited artwork in room" 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                  draggable="false"
              />
          </div>
          
          <div 
              className="absolute top-0 bottom-0 w-1 bg-white mix-blend-difference pointer-events-none"
              style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg ring-2 ring-white/50">
                <CompareIcon />
              </div>
          </div>
          
          <div 
            className="absolute top-2 left-2 bg-slate-800/60 text-white text-xs font-semibold px-2 py-1 rounded-full pointer-events-none"
            style={{ opacity: sliderPosition < 50 ? 1 : 0, transition: 'opacity 0.3s' }}
          >
              {t('original_label')}
          </div>
          <div 
              className="absolute top-2 right-2 bg-slate-800/60 text-white text-xs font-semibold px-2 py-1 rounded-full pointer-events-none"
              style={{ opacity: sliderPosition > 50 ? 1 : 0, transition: 'opacity 0.3s' }}
          >
              {t('effect_label')}
          </div>

          {isDrawing && (
            <div className="absolute inset-0 z-20 bg-black bg-opacity-50">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain pointer-events-auto cursor-crosshair"
                onMouseDown={startDrawing}
                onTouchStart={startDrawing}
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button onClick={finishDrawing} className="bg-slate-700 text-white py-2 px-4 rounded-full font-medium shadow-lg">{t('done_button')}</button>
                <button onClick={() => { setIsDrawing(false); clearCanvas(); }} className="bg-white/80 text-black py-2 px-4 rounded-full font-medium shadow-lg">{t('cancel_button')}</button>
              </div>
            </div>
          )}
          
          {isLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl z-30">
                <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-slate-600"></div>
                <p className="mt-4 text-slate-600">{t('applying_edits')}</p>
              </div>
          )}
        </div>
        <div className="absolute top-0 right-0 h-full flex items-center translate-x-full pl-2 pointer-events-none">
          <span className="text-slate-500 text-sm whitespace-nowrap" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            {t('compare_slider_title')}
          </span>
        </div>
      </div>


      <div className="w-full bg-white/40 backdrop-blur-lg border border-white/50 rounded-2xl p-6 mt-8 shadow-lg">
        <h3 className="font-serif text-2xl font-bold text-slate-900 mb-4">{t('detail_adjustment_title')}</h3>
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('frame_materials_label')}</label>
                    <select
                        value={localEditOptions.frameMaterial || ''}
                        onChange={(e) => setLocalEditOptions(prev => ({...prev, frameMaterial: e.target.value || undefined }))}
                        className="w-full px-3 py-2 border border-slate-300/50 rounded-lg focus:ring-1 focus:ring-pink-400 outline-none bg-white/60 backdrop-blur-sm"
                    >
                        <option value="">{t('none_option')}</option>
                        {framingOptions.materials.map(category => (
                            <optgroup key={category.category.en} label={category.category[language]}>
                            {category.items.map(item => (
                                <option key={item.en} value={item[language]}>
                                {item[language]}
                                </option>
                            ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('frame_color_label')}</label>
                    <select
                        value={localEditOptions.frameColor || ''}
                        onChange={(e) => setLocalEditOptions(prev => ({...prev, frameColor: e.target.value || undefined }))}
                        className="w-full px-3 py-2 border border-slate-300/50 rounded-lg focus:ring-1 focus:ring-pink-400 outline-none bg-white/60 backdrop-blur-sm"
                    >
                        <option value="">{t('none_option')}</option>
                        {framingOptions.colors.map(category => (
                            <optgroup key={category.category.en} label={category.category[language]}>
                            {category.items.map(item => (
                                <option key={item.en} value={item[language]}>
                                {item[language]}
                                </option>
                            ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('mounting_methods_label')}</label>
                    <select
                        value={localEditOptions.mountingMethod || ''}
                        onChange={(e) => setLocalEditOptions(prev => ({...prev, mountingMethod: e.target.value || undefined }))}
                        className="w-full px-3 py-2 border border-slate-300/50 rounded-lg focus:ring-1 focus:ring-pink-400 outline-none bg-white/60 backdrop-blur-sm"
                    >
                         <option value="">{t('none_option')}</option>
                         {framingOptions.mounting.map(category => (
                            <optgroup key={category.category.en} label={category.category[language]}>
                            {category.items.map(item => (
                                <option key={item.en} value={item[language]}>
                                {item[language]}
                                </option>
                            ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('glazing_protection_label')}</label>
                     <select
                        value={localEditOptions.glazingType || ''}
                        onChange={(e) => setLocalEditOptions(prev => ({...prev, glazingType: e.target.value || undefined }))}
                        className="w-full px-3 py-2 border border-slate-300/50 rounded-lg focus:ring-1 focus:ring-pink-400 outline-none bg-white/60 backdrop-blur-sm"
                    >
                         <option value="">{t('none_option')}</option>
                         {framingOptions.glazing.map(category => (
                            <optgroup key={category.category.en} label={category.category[language]}>
                            {category.items.map(item => (
                                <option key={item.en} value={item[language]}>
                                {item[language]}
                                </option>
                            ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('text_prompt_label')}
                        {maskImage && <span className="text-blue-600 font-normal text-xs ml-2">{t('mask_selected_label')}</span>}
                </label>
                <div className="flex gap-2">
                    <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder={t('text_prompt_placeholder')}
                    className="w-full h-28 px-3 py-2 border border-slate-300/50 rounded-lg focus:ring-1 focus:ring-pink-400 outline-none resize-none flex-grow bg-white/60 backdrop-blur-sm"
                    disabled={isLoading}
                    />
                    <button 
                    onClick={toggleDrawing} 
                    aria-label={t('brush_label')}
                    disabled={isLoading}
                    className={`flex flex-col items-center justify-center text-center px-4 py-2 border rounded-lg transition-colors ${isDrawing || maskImage ? 'bg-slate-700 text-white border-slate-700' : 'bg-white/60 hover:bg-white/80 border-slate-300/50'}`}
                    >
                     <span className="text-xs font-medium">{t('brush_label_short')}</span>
                     <BrushIcon className="w-5 h-5 mt-1" />
                    </button>
                </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('replace_artwork_label')}</label>
              <div className="relative">
                <div
                  onClick={() => !isLoading && newArtInputRef.current?.click()}
                  className={`relative w-full h-28 border border-white/60 rounded-lg flex items-center justify-center text-slate-600 bg-white/50 cursor-pointer hover:bg-white/70 hover:border-white/90 transition-colors ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {newArtwork ? (
                    <img src={newArtwork} alt={t('new_artwork_alt')} className="w-full h-full object-contain rounded-md p-1" />
                  ) : (
                    <span className="text-sm">{t('replace_artwork_prompt')}</span>
                  )}
                </div>
                {newArtwork && !isLoading && (
                  <button
                    onClick={() => setNewArtwork(null)}
                    className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-md"
                    aria-label={t('clear_button')}
                  >
                    <XIcon className="w-4 h-4 text-black" />
                  </button>
                )}
                <input
                  ref={newArtInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleNewArtUpload}
                  disabled={isLoading}
                />
              </div>
            </div>

             <div className="border-t border-white/50 pt-4 flex justify-end">
                <button onClick={handleRegenerate} disabled={isLoading || !hasEdits} className="text-center py-2 px-8 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-300 text-white rounded-full font-medium text-sm transition-colors shadow-md hover:scale-105">
                    {t('regenerate_button')}
                </button>
            </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleDownload}
          className="bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-8 rounded-full transition-all duration-300 shadow-md hover:scale-105 hover:brightness-110"
        >
          {t('download_button')}
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo || isLoading}
          className="bg-white/60 hover:bg-white/80 text-slate-800 font-medium py-2 px-8 rounded-full transition-colors duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
        >
          {t('undo_button')}
        </button>
        <button
          onClick={onReset}
          className="bg-white/60 hover:bg-white/80 text-slate-800 font-medium py-2 px-8 rounded-full transition-colors duration-300 shadow-md hover:scale-105"
        >
          {t('start_over_button')}
        </button>
      </div>
    </div>
  );
};
