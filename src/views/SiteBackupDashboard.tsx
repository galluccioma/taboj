// Componente dashboard per visualizzare i dati di backup SEO in una sezione completa
import React, { useState } from 'react';
import getStatusColor from '../utils/getStatusColor';
import AiChatDialog from '../components/AiChatDialog';
import { BotMessageSquare } from 'lucide-react';

function getTitleColor(
  title: string,
) {
  const match = title.match(/(H\d)\s*"(.*?)"\s*\((\d+)\s*caratteri\)/);
  if (!match) return '';
  const length = parseInt(match[3], 10);
  // Colori in base alla lunghezza
  if (length >= 50 && length <= 60) return '';
  if ((length >= 40 && length < 50) || (length > 60 && length <= 70)) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Dashboard per visualizzare i dati di backup SEO in una sezione completa, con chat AI
 */
function SiteBackupDashboard({ data }: { data: Record<string, any>[] }) {
  const [showAiChat, setShowAiChat] = useState(false);
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  // chatId unico per backup: usa primo Url o fallback
  const chatId = data[0]?.Url ? `backup:${data[0].Url}` : 'backup:default';
  return (
    <section className="bg-slate-800 rounded shadow p-4 mt-6">
      {/* Pulsante per chat AI */}
      <div className="flex justify-end mb-4">
        <button
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-sm font-medium"
          onClick={() => setShowAiChat(true)}
        >
          <BotMessageSquare/> Chatta con AI
        </button>
      </div>
      <div className="space-y-8">
        {data.map((row, idx) => {
          const titles = (row['Titoli [lenght e consigli]'] || '').split(' | ');
          const hasH2 = titles.some((t: string) => t.trim().startsWith('H2'));
          const hasH1 = titles.some((t: string) => t.trim().startsWith('H1'));
          const h1Count = titles.filter((t: string) => t.trim().startsWith('H1')).length;

          return (
            <div key={row.Url || idx} className="border-b border-slate-600 pb-4 mb-4 space-y-4">
              <div>
                <strong>URL:</strong> <span className="ml-2">{row.Url}</span>
              </div>
              <div>
                <strong>Meta Title:</strong>
                <span className={`ml-2 ${getStatusColor('Meta title[length]', row['Meta title[length]'])}`}>
                  {row['Meta title[length]']}
                </span>
              </div>
              <div>
                <strong>Description:</strong>
                <span className={`ml-2 ${getStatusColor('Description[length]', row['Description[length]'])}`}>
                  {row['Description[length]']}
                </span>
              </div>
              <div>
                <strong>Keywords:</strong>
                <span className={`ml-2 ${getStatusColor('Keywords', row.Keywords)}`}>{row.Keywords}</span>
              </div>
              <div>
                <strong>Robots:</strong> <span className="ml-2">{row.robots}</span>
              </div>
              {!hasH1 && (
                <div className="text-yellow-500 font-semibold">
                  ⚠️ Attenzione: manca il tag H1!
                </div>
              )}
              {h1Count > 1 && (
                <div className="text-yellow-500 font-semibold">
                  ⚠️ Attenzione: sono presenti più tag H1!
                </div>
              )}
              {!hasH2 && (
                <div className="text-yellow-500 font-semibold">
                  ⚠️ Attenzione: manca il tag H2!
                </div>
              )}
              <div>
                <strong>Titoli & Consigli:</strong>
                <ul className="ml-2 list-disc">
                {titles.map((titolo: string, i: number) => (
                    <li
                    key={titolo.trim() + '-' + i}
                    className={getTitleColor(titolo)}
                    >
                      {titolo.trim()}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Status HTTP:</strong>
                <span className={`ml-2 ${getStatusColor('Status HTTP', row['Status HTTP'])}`}>{row['Status HTTP']}</span>
              </div>
              <div>
                <strong>Strumenti analitici:</strong>
                <span className={`ml-2 ${getStatusColor('Strumenti analitici', row['Strumenti analitici'])}`}>
                  {row['Strumenti analitici']}
                </span>
              </div>
              <div>
                <strong>Cookie banner:</strong>
                <span className={`ml-2 ${getStatusColor('Cookie banner', row['Cookie banner'])}`}>
                  {row['Cookie banner']}
                </span>
              </div>
              <div>
                <strong>CMS rilevato:</strong>
                <span className={`ml-2 ${getStatusColor('CMS rilevato', row['CMS rilevato'])}`}>
                  {row['CMS rilevato']}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Dialog per la chat AI */}
      <AiChatDialog open={showAiChat} onClose={() => setShowAiChat(false)} context={data} chatId={chatId} quickActions={[
        { label: 'Analisi SEO', prompt: 'Forniscimi un riepilogo sintetico con focus sulla SEO' },
        { label: 'Keyword più frequenti', prompt: 'Forniscimi una lista delle 10 parole più frequenti presenti tra descrizioni, titoli e keywords.' }
      ]} />
    </section>
  );
}

export default SiteBackupDashboard;
