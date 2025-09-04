
import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ArtGallery } from './components/ArtGallery';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingIndicator } from './components/LoadingIndicator';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { AppStep, Artwork } from './types';
import { ARTWORK_GALLERY, AGENT_STEPS } from './constants';
import { enhanceRoomPhoto, placeArtworkInRoom } from './services/geminiService';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD_HOME);
  const [homeImage, setHomeImage] = useState<string | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>(ARTWORK_GALLERY);
  const [selectedArt, setSelectedArt] = useState<Artwork | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);

  const handleHomeImageUpload = async (base64Image: string) => {
    setHomeImage(base64Image); // Show original for immediate feedback
    setIsEnhancing(true);
    setError(null);

    try {
      const enhancedImage = await enhanceRoomPhoto(base64Image);
      setHomeImage(enhancedImage);
      setStep(AppStep.SELECT_ART);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enhance the photo.");
      setHomeImage(null);
      setStep(AppStep.UPLOAD_HOME);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleArtSelect = (artwork: Artwork) => {
    setSelectedArt(artwork);
    setError(null);
  };
  
  const handleUserArtUpload = (base64Image: string) => {
    const newUserArt: Artwork = {
      id: `user-${Date.now()}`,
      title: 'Your Artwork',
      artist: 'You',
      imageUrl: base64Image,
    };
    
    // Prepend new art and automatically select it
    setArtworks([newUserArt, ...artworks]);
    setSelectedArt(newUserArt);
    setError(null);
  };


  const handleGenerate = useCallback(async () => {
    if (!homeImage || !selectedArt) {
      setError("Please upload a room photo and select an artwork.");
      return;
    }

    setIsLoading(true);
    setStep(AppStep.GENERATING);
    setError(null);

    try {
       // For user-uploaded art, the imageUrl is already a base64 string
      const isBase64 = selectedArt.imageUrl.startsWith('data:image');
      
      const processArt = async (artBase64: string) => {
         try {
          // Pass the enhanced homeImage to the placement function
          const result = await placeArtworkInRoom(homeImage, artBase64);
          setGeneratedImage(result);
          setStep(AppStep.RESULT);
        } catch (err) {
          setError(err instanceof Error ? err.message : "An unknown error occurred during image generation.");
          setStep(AppStep.SELECT_ART);
        } finally {
          setIsLoading(false);
        }
      }

      if (isBase64) {
        await processArt(selectedArt.imageUrl);
      } else {
        const response = await fetch(selectedArt.imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          await processArt(reader.result as string);
        };
        reader.onerror = () => {
           throw new Error("Failed to convert artwork to base64.");
        }
      }
    } catch(err) {
        setError(err instanceof Error ? err.message : "Failed to fetch artwork image.");
        setStep(AppStep.SELECT_ART);
        setIsLoading(false);
    }
  }, [homeImage, selectedArt]);

  const handleReset = () => {
    setStep(AppStep.UPLOAD_HOME);
    setHomeImage(null);
    setSelectedArt(null);
    setGeneratedImage(null);
    setError(null);
    setIsLoading(false);
    setIsEnhancing(false);
    setArtworks(ARTWORK_GALLERY); // Reset gallery to default
  };

  const renderStepContent = () => {
    switch (step) {
      case AppStep.GENERATING:
        return <LoadingIndicator steps={AGENT_STEPS} />;
      case AppStep.RESULT:
        return generatedImage && <ResultDisplay generatedImage={generatedImage} onReset={handleReset} />;
      default:
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
              <div className="flex flex-col space-y-4">
                <h2 className="text-2xl font-bold text-teal-600">Step 1: Upload Your Room</h2>
                <ImageUploader 
                  image={homeImage}
                  onImageUpload={handleHomeImageUpload} 
                  isLoading={isEnhancing}
                />
              </div>
              <div className={`flex flex-col space-y-4 transition-opacity duration-500 ${step === AppStep.SELECT_ART ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <h2 className="text-2xl font-bold text-teal-600">Step 2: Select Artwork</h2>
                <ArtGallery 
                  artworks={artworks} 
                  selectedArtId={selectedArt?.id} 
                  onArtSelect={handleArtSelect}
                  onUserArtUpload={handleUserArtUpload}
                />
              </div>
            </div>
            {error && <p className="text-red-600 mt-4 text-center">{error}</p>}
            <div className="mt-8">
              <button
                onClick={handleGenerate}
                disabled={step !== AppStep.SELECT_ART || !selectedArt || isLoading}
                className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-teal-500/20 transform hover:scale-105 transition-all duration-300 ease-in-out"
              >
                <SparklesIcon />
                Generate Visualization
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <Header />
      <main className="flex flex-col items-center justify-center w-full flex-grow text-center mt-8">
        {renderStepContent()}
      </main>
    </div>
  );
};

export default App;