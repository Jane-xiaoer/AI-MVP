import React from 'react';
import { Language } from '../types';
import type { AccessMode } from '../lib/settings';

interface HeaderProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  mode: AccessMode;
  onOpenSettings: () => void;
  onGoHall?: () => void; // 保留供未来返回居家馆用;当前不放中间品牌
  showSettings?: boolean; // 试用中/key badge 只在挂画页显示(它只跟挂画的 Gemini key 有关)
}

const modeBadge: Record<AccessMode, { icon: string; label: { en: string; zh: string }; tone: string }> = {
  master: { icon: '🔓', label: { en: 'Master',  zh: '管理员' }, tone: 'bg-emerald-100 text-emerald-700' },
  byok:   { icon: '🪙', label: { en: 'Your key', zh: '自带 key' }, tone: 'bg-amber-100 text-amber-700' },
  free:   { icon: '⚙️', label: { en: 'Trial',    zh: '试用中'  }, tone: 'bg-white/70 text-slate-600' },
};

export const Header: React.FC<HeaderProps> = ({ currentLang, onLangChange, mode, onOpenSettings, showSettings }) => {
  const badge = modeBadge[mode];
  const toggleLanguage = () => onLangChange(currentLang === 'en' ? 'zh' : 'en');

  return (
    <header className="w-full max-w-6xl flex items-center justify-between gap-2">
      {/* 回馆藏 —— 给大馆引流 */}
      <a
        href="https://xiaoercamera.xyz"
        title={currentLang === 'en' ? 'Back to Xiaoer Collections' : '回小耳馆藏'}
        className="flex items-center text-slate-500 hover:text-slate-800 text-xs sm:text-sm font-medium transition-colors duration-300 shrink-0"
      >
        ← 回小耳馆藏<span className="hidden sm:inline"> · Collections</span>
      </a>

      <div className="flex items-center space-x-2 shrink-0">
        {showSettings && (
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold hover:opacity-80 transition-opacity shadow-sm ${badge.tone}`}
            title={currentLang === 'en' ? 'Access settings' : '访问设置'}
          >
            <span>{badge.icon}</span>
            <span className="hidden sm:inline">{badge.label[currentLang]}</span>
          </button>
        )}
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
