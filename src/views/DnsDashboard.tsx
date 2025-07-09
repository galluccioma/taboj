import React from 'react';

import getStatusColor from '../utils/getStatusColor';

function DnsDashboard({ data }: { data: Record<string, any>[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return (
    <div className="space-y-8">
      {data.map((row, idx) => (
        <div key={idx} className="border-b border-slate-600 pb-4 mb-4">
          <div>
            <strong>Dominio:</strong> <span className="ml-2">{row.domain}</span>
          </div>
          {row.http_status !== undefined && (
            <div>
              <strong>HTTP Status:</strong>
              <span className={`ml-2 ${getStatusColor('Status HTTP', row.http_status)}`}>{row.http_status}</span>
            </div>
          )}
          {row.ssl_status !== undefined && (
           <div>
              <strong>SSL Status:</strong>
              <span className={`ml-2 ${getStatusColor('Status SSL', row.ssl_status)}`}>{row.ssl_status}</span>
            </div>
          )}
          <div>
            <strong>DNS Records:</strong>
            <ul className="ml-4 list-disc">
              {Object.entries(row)
                .filter(([k]) => ['A', 'NS', 'MX', 'TXT', 'CNAME', 'AAAA'].includes(k))
                .map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}:</strong> <span className={`ml-2 ${getStatusColor('null', v)}`}>{v}</span>
                  </li>
                ))}
            </ul>
          </div>
          {row.mail_A && (
            <div>
                <strong>mail_A:</strong> <span className={`ml-2 ${getStatusColor('null', row.mail_A)}`}>{row.mail_A}</span>
            </div>
          )}
          {(row.performance || row.lighthouse_average) && (
            <div>
              <strong>Lighthouse:</strong>
              <ul className="ml-4 list-disc">
                <li>Performance: {row.performance}</li>
                <li>Accessibility: {row.accessibility}</li>
                <li>SEO: {row.seo}</li>
                <li>Best Practices: {row.bestPractices}</li>
                <li>Media: {row.lighthouse_average}</li>
              </ul>
            </div>
          )}
          {row.wayback_snapshots && (
            <div>
              <strong>Wayback:</strong>
              <ul className="ml-4 list-disc">
                <li>Snapshots: {row.wayback_snapshots}</li>
                <li>First: {row.wayback_first_date}</li>
                <li>Last: {row.wayback_last_date}</li>
                <li>Years Online: {row.wayback_years_online}</li>
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default DnsDashboard;
