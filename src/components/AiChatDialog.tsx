import React, { useState, useRef, useEffect, useMemo } from 'react';
import {BotMessageSquare} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/**
 * Dialog per la chat AI integrata.
 * Props:
 * - open: boolean (se la dialog è visibile)
 * - onClose: funzione per chiudere la dialog
 * - context: string | object (opzionale, contesto da passare come system message)
 * - chatId: string (opzionale, identificatore unico per la sessione chat)
 * - quickActions: array di azioni rapide [{ label, prompt }]
 */
type QuickAction = { label: string; prompt: string };
type AiChatDialogProps = {
  open: boolean;
  onClose: () => void;
  context?: string | object;
  chatId?: string;
  quickActions?: QuickAction[];
};

function AiChatDialog({ open, onClose, context, chatId, quickActions }: AiChatDialogProps) {
  const systemPrompt = 'Sei un assistente AI esperto in Web e Digital Marketing, creazione di Contenuti e SEO. Lavori per una agenzia che aiuta i propri clienti ad analizzare e interpretare dati provenienti da file JSON relativi a clienti attuali o potenziali. Il tuo compito è fornire analisi chiare, sintetiche e utili, anche a interlocutori non tecnici. Fornisci sempre risposte in formato markdown che siano concise e comprensibili.'
  const contextText = context
    ? `\nHai ricevuto il seguente contesto aziendale:':\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}`
    : '';

  const initialSystemMessage = useMemo(() => {
    return { role: 'system', content: systemPrompt + contextText };
  }, [context]);

  const [messages, setMessages] = useState([initialSystemMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  async function handleSend() {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    try {
      let aiToken = '';
      let aiModel = '';
      if (window.electron && (window.electron as any).invoke) {
        const settings = await (window.electron as any).invoke('get-app-settings');
        aiToken = settings?.aiToken || '';
        aiModel = settings?.aiModel || 'meta-llama/Llama-3.2-3B-Instruct';
      }
      if (!aiToken) throw new Error('Token AI mancante.');

      const result = await (window.electron as any).invoke('ai-chat', {
        messages: newMessages,
        aiToken,
        aiModel,
      });

      if (result.success) {
        setMessages([...newMessages, { role: 'assistant', content: result.message }]);
      } else {
        setError(result.error || 'Errore nella risposta AI.');
      }
    } catch (e: any) {
      setError(e?.message || 'Errore nella risposta AI.');
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div
        className="bg-slate-800 p-6 rounded shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="flex gap-4 text-lg font-bold text-slate-200"> <BotMessageSquare/> Chat AI</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-400 text-xl"
            title="Chiudi"
          >
            &times;
          </button>
        </div>
        {/* Area contesto */}
        <div
          className="flex-1 overflow-y-auto bg-slate-900 rounded-lg p-3 mb-3 border border-slate-700"
          style={{ minHeight: 200, maxHeight: 350 }}
        >
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={msg.role === 'user' ? 'text-right mb-2' : 'text-left mb-2'}
            >
              <div
                className={
                  msg.role === 'user'
                    ? 'inline-block bg-green-700 text-white px-3 py-2 rounded-xl max-w-[80%]'
                    : 'inline-block bg-slate-700 text-slate-100 px-3 py-2 rounded-xl max-w-[80%]'
                }
              >
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="text-red-400 text-sm mb-2 bg-red-900 px-2 py-1 rounded-lg border border-red-700">
            {error}
          </div>
        )}
        {/* Pulsanti azioni rapide */}
        {quickActions && quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-full text-xs"
                onClick={() => setInput(action.prompt)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        {/* Are di risposta */}
        <div className={`flex gap-2 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          <textarea
            className="flex-1 p-2 rounded-lg bg-slate-900 text-slate-200 border border-slate-600 resize-none"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi una domanda o chiedi un'analisi... (Ctrl+Invio per inviare)"
            disabled={loading}
          />
          <button
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg self-end"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? '...' : 'Invia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiChatDialog;
