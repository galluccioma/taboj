import React from 'react';

interface FooterProps {
  statusRef: React.RefObject<HTMLDivElement>;
  statusMessages: string[];
  handleContinueCaptcha: () => void;
}

export default function Footer({ statusRef, statusMessages, handleContinueCaptcha }: FooterProps) {
  return (
    <footer
      className="log mt-4 bg-slate-900  rounded p-4 h-40 overflow-y-auto text-sm"
      id="statusMessage"
      ref={statusRef}
    >
      <a href="https://galluccioma.com/" target="_blank" rel="noopener noreferrer" className="block text-center mb-2">
        ☃︎ -io
      </a>
      {statusMessages.map((msg) => (
        <p key={msg}>
          {msg.includes('CAPTCHA richiesto') ? (
            <span>
              {msg}
              <button className="ml-2 px-2 py-1 bg-yellow-300 rounded" onClick={handleContinueCaptcha}>
                Continua dopo CAPTCHA
              </button>
            </span>
          ) : (
            <span>{msg}</span>
          )}
        </p>
      ))}
    </footer>
  );
}
