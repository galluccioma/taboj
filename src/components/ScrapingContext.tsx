import React, { createContext, useContext, useState } from 'react';

/**
 * Contesto globale per tracciare se uno scraping è in corso
 */
interface ScrapingContextType {
  scraping: boolean;
  setScraping: (value: boolean) => void;
}

const ScrapingContext = createContext<ScrapingContextType>({
  scraping: false,
  setScraping: () => {},
});

export const useScraping = () => useContext(ScrapingContext);

export const ScrapingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scraping, setScraping] = useState(false);
  return (
    <ScrapingContext.Provider value={{ scraping, setScraping }}>
      {children}
    </ScrapingContext.Provider>
  );
}; 