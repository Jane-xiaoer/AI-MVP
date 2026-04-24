
import React, { useState, useCallback, useContext } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ArtGallery } from './components/ArtGallery';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingIndicator } from './components/LoadingIndicator';
import { AppStep, Artwork, EditOptions } from './types';
import { AGENT_STEPS } from './locales';
import { placeArtworkInRoom, editArtworkInRoom } from './services/geminiService';
import { LanguageContext } from './context/LanguageContext';
import { useTranslation } from './hooks/useTranslation';
import { resizeArtworkToMatchRoom } from './utils/imageUtils';
import { MAX_ARTWORKS } from './constants';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD_HOME);
  const [homeImage, setHomeImage] = useState<string | null>(null);
  const [originalHomeImage, setOriginalHomeImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [artwork, setArtwork] = useState<Artwork | null>(null);

  const { language, setLanguage } = useContext(LanguageContext);
  const t = useTranslation();

  const handleHomeImageUpload = (base64Image: string) => {
    setError(null);
    setOriginalHomeImage(base64Image);
    setHomeImage(base64Image);
    setStep(AppStep.SELECT_ART);
  };
  
  const handleArtUpload = (base64Image: string) => {
    setError(null);
    const newArtwork: Artwork = {
      id: `user-art-${Date.now()}`,
      title: t('user_art_title'),
      artist: t('user_art_artist'),
      imageUrl: base64Image,
    };
    setArtwork(newArtwork);
  };

  const handleRemoveArt = () => {
    setArtwork(null);
  };


  const handleGenerate = useCallback(async () => {
    if (!homeImage) {
      setError(t('error_upload_room'));
      return;
    }
    if (!artwork) {
      setError(t('error_select_art'));
      return;
    }

    setIsLoading(true);
    setStep(AppStep.GENERATING);
    setError(null);

    try {
      // Pre-process artwork to match the home image's aspect ratio
      const paddedArtUrl = await resizeArtworkToMatchRoom(homeImage, artwork.imageUrl);
      
      const result = await placeArtworkInRoom(homeImage, [paddedArtUrl]);
      setGeneratedImages([result]);
      setStep(AppStep.RESULT);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generation_failed'));
      setStep(AppStep.SELECT_ART);
    } finally {
      setIsLoading(false);
    }
  }, [homeImage, artwork, t]);

  const handleEditImage = useCallback(async (options: Omit<EditOptions, 'baseImage'>) => {
    if (generatedImages.length === 0) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const baseImage = generatedImages[generatedImages.length - 1];
      const result = await editArtworkInRoom({
        baseImage,
        ...options,
      });
      setGeneratedImages(prev => [...prev, result]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_edit_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [generatedImages, t]);

  const handleReset = () => {
    setStep(AppStep.UPLOAD_HOME);
    setHomeImage(null);
    setOriginalHomeImage(null);
    setArtwork(null);
    setGeneratedImages([]);
    setError(null);
    setIsLoading(false);
  };
  
  const handleUndo = () => {
    if (generatedImages.length > 1) {
      setGeneratedImages(prev => prev.slice(0, -1));
    }
  };

  const renderContent = () => {
    switch (step) {
      case AppStep.GENERATING: {
        const steps = AGENT_STEPS[language];
        return <LoadingIndicator steps={steps} />;
      }
      case AppStep.RESULT: {
        if (generatedImages.length === 0 || !originalHomeImage) return null;
        
        const baseImage = generatedImages.length > 1 
          ? generatedImages[generatedImages.length - 2] 
          : originalHomeImage;
        const editedImage = generatedImages[generatedImages.length - 1];

        return (
          <ResultDisplay 
            baseImage={baseImage}
            editedImage={editedImage} 
            onReset={handleReset} 
            onEdit={handleEditImage}
            isLoading={isLoading}
            onUndo={handleUndo}
            canUndo={generatedImages.length > 1}
          />
        );
      }
      default:
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
              <div className="bg-white/40 backdrop-blur-lg rounded-2xl border border-white/50 shadow-lg p-6 flex flex-col space-y-4">
                <div className='text-left'>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">{t('your_space_title')}</h2>
                </div>
                <ImageUploader 
                  image={homeImage}
                  onImageUpload={handleHomeImageUpload} 
                  isLoading={false}
                />
              </div>
              <div className={`bg-white/40 backdrop-blur-lg rounded-2xl border border-white/50 shadow-lg p-6 flex flex-col space-y-4 transition-opacity duration-500 ${step === AppStep.SELECT_ART ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className='text-left'>
                  <div className="flex justify-between items-baseline">
                    <h2 className="font-serif text-2xl font-bold text-slate-900">{t('artwork_title')}</h2>
                  </div>
                </div>
                <ArtGallery 
                  artwork={artwork}
                  onArtUpload={handleArtUpload}
                  onRemoveArt={handleRemoveArt}
                  canUpload={!artwork}
                />
              </div>
            </div>
            {error && <p className="text-red-600 mt-4 text-center">{error}</p>}
            <div className="mt-12">
              <button
                onClick={handleGenerate}
                disabled={step !== AppStep.SELECT_ART || isLoading || !artwork}
                className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium tracking-wider uppercase py-3 px-12 rounded-full transition-all duration-300 ease-in-out shadow-lg hover:scale-105 hover:brightness-110"
              >
                {t('generate_button')}
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <Header 
        currentLang={language}
        onLangChange={setLanguage}
      />
      <main className="flex flex-col items-center justify-center w-full flex-grow text-center mt-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
