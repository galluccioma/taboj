import React from 'react';
import getStatusColor from '../utils/getStatusColor';

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

function SiteBackupDashboard({ data }: { data: Record<string, any>[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return (
    <div className="space-y-8">
      {data.map((row, idx) => {
        const titles = (row['Titoli [lenght e consigli]'] || '').split(' | ');
        const hasH2 = titles.some((t: string) => t.trim().startsWith('H2'));
        const hasH1 = titles.some((t: string) => t.trim().startsWith('H1'));
        const h1Count = titles.filter((t: string) => t.trim().startsWith('H1')).length;

        return (
          <div key={idx} className="border-b border-slate-600 pb-4 mb-4 space-y-4">
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
                {titles.map((titolo: string) => (
                  <li
                    key={titolo.trim()}
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
  );
}

export default SiteBackupDashboard;
