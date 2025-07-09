// src/types/electron.d.ts

export {};

declare global {
  interface Window {
    electron?: {
      chooseFolder: () => Promise<string>;
      getUsername: () => Promise<string>;
      // Overload for DNS/maps/faq
      startScraping: (
        searchString: string,
        scrapingType: 'dns' | 'maps' | 'faq',
        folderPath: string,
        headless: boolean,
        dnsRecordTypes: string[],
        doAMail: boolean,
        doLighthouse: boolean,
        doWayback: boolean,
        useProxy: boolean,
        customProxy: string
      ) => void;
      // Overload for backup
      startScraping: (
        searchString: string,
        scrapingType: 'backup',
        folderPath: string,
        headless: boolean,
        useProxy: boolean,
        customProxy: string,
        fullBackup: boolean
      ) => void;
      // For backup
      startBackupScraping: (
        searchString: string,
        folderPath: string,
        headless: boolean,
        useProxy: boolean,
        customProxy: string,
        fullBackup: boolean,
        downloadMedia: boolean
      ) => void;
      stopScraping: () => void;
      onStatus: (cb: (message: string) => void) => void;
      onResetLogs: (cb: () => void) => void;
      onUserActionRequired: (cb: (message: string) => void) => void;
      confirmUserAction: () => void;
      on: (channel: string, callback: (data: any) => void) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}