
import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface ApiKeyInputProps {
  onSubmit: (apiKey: string) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onSubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const t = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey.trim());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-8 rounded-lg">
      <h2 className="font-serif text-3xl font-bold text-center text-gray-900 mb-2">{t('api_key_title')}</h2>
      <p className="text-center text-gray-500 mb-6">
        {t('api_key_description')}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t('api_key_placeholder')}
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition"
          required
        />
        <button
          type="submit"
          className="bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md transition-colors duration-300"
        >
          {t('api_key_submit_button')}
        </button>
      </form>
       <p className="text-xs text-gray-400 mt-4 text-center">
        {t('api_key_helper_text_1')} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-black underline">{t('api_key_helper_text_2')}</a>.
      </p>
    </div>
  );
};