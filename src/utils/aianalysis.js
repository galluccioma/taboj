// Funzione per la chat AI con HuggingFace
import { HfInference } from '@huggingface/inference'
/**
 * Esegue una chat AI con HuggingFace dato uno storico di messaggi.
 * @param {Object} params
 * @param {Array} params.messages - Array di messaggi [{role: 'user'|'assistant'|'system', content: string}]
 * @param {string} params.aiToken - Il token HuggingFace
 * @param {string} params.aiModel - Il modello AI
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function chatWithAI({ messages, aiToken, aiModel }) {
  try {
    const client = new HfInference(aiToken);
    const chatCompletion = await client.chatCompletion({
      provider: "novita",
      model: aiModel,
      messages
    });
    const aiMessage = chatCompletion.choices[0].message.content;
    return { success: true, message: aiMessage };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default chatWithAI
