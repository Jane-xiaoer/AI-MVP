import React from 'react';
import { Language } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import type { AccessMode } from '../lib/settings';

interface HeaderProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  mode: AccessMode;
  onOpenSettings: () => void;
}

const modeBadge: Record<AccessMode, { icon: string; label: { en: string; zh: string }; tone: string }> = {
  master: { icon: '🔓', label: { en: 'Master',  zh: '管理员' }, tone: 'bg-emerald-100 text-emerald-700' },
  byok:   { icon: '🪙', label: { en: 'Your key', zh: '自带 key' }, tone: 'bg-amber-100 text-amber-700' },
  free:   { icon: '⚙️', label: { en: 'Trial',    zh: '试用中'  }, tone: 'bg-white/70 text-slate-600' },
};

export const Header: React.FC<HeaderProps> = ({ currentLang, onLangChange, mode, onOpenSettings }) => {
  const t = useTranslation();
  const badge = modeBadge[mode];

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
      <div className="absolute top-0 right-0 flex items-center space-x-2 h-full">
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold hover:opacity-80 transition-opacity shadow-sm ${badge.tone}`}
          title={currentLang === 'en' ? 'Access settings' : '访问设置'}
        >
          <span>{badge.icon}</span>
          <span className="hidden sm:inline">{badge.label[currentLang]}</span>
        </button>
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
