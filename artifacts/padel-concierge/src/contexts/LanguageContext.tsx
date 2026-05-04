import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'ru' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.matches': 'Matches',
    'nav.bookings': 'Bookings',
    'nav.profile': 'Profile',
    'nav.videoAnalysis': 'Video Analysis',
    'nav.settings': 'Settings',
  },
  ru: {
    'nav.dashboard': 'Панель',
    'nav.matches': 'Матчи',
    'nav.bookings': 'Бронирования',
    'nav.profile': 'Профиль',
    'nav.videoAnalysis': 'Видео Анализ',
    'nav.settings': 'Настройки',
  },
  ar: {
    'nav.dashboard': 'لوحة القيادة',
    'nav.matches': 'المباريات',
    'nav.bookings': 'الحجوزات',
    'nav.profile': 'الملف الشخصي',
    'nav.videoAnalysis': 'تحليل الفيديو',
    'nav.settings': 'الإعدادات',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: string) => {
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
