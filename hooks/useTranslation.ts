
import { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../locales';

export const useTranslation = () => {
  const { language } = useContext(LanguageContext);

  const t = (key: keyof typeof translations.en, options?: { [key: string]: string | number }) => {
    let text = translations[language][key] || translations['en'][key];
    if (options) {
      Object.keys(options).forEach(optionKey => {
        const regex = new RegExp(`{{${optionKey}}}`, 'g');
        text = text.replace(regex, String(options[optionKey]));
      });
    }
    return text;
  }

  return t;
};