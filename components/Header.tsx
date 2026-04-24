
import React from 'react';
import { Language } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface HeaderProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentLang, onLangChange }) => {
  const t = useTranslation();

  const toggleLanguage = () => {
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    onLangChange(newLang);
  };

  return (
    <header className="w-full max-w-6xl text-center relative">
      <h1 className="font-serif text-5xl sm:text-6xl font-bold text-slate-900">
        {t('main_title')}
      </h1>
      <h2 className="mt-4 text-3xl text-slate-700">
        {t('subtitle')}
      </h2>
      <p className="mt-2 text-base text-slate-500">
        {t('description')}
      </p>
      <div className="absolute top-0 right-0 flex items-center space-x-4 h-full">
        <button
          onClick={toggleLanguage}
          className="bg-white/50 hover:bg-white/80 text-slate-700 font-medium py-2 px-4 rounded-full text-sm transition-colors duration-300 shadow-sm"
        >
          {currentLang === 'en' ? '中文' : 'English'}
        </button>
      </div>
    </header>
  );
};