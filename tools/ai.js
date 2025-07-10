
import { InferenceClient } from "@huggingface/inference";

const HF_TOKEN="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"
const client = new InferenceClient(HF_TOKEN);
const BASE_URL="https://www.coralsorsidisicilia.com/"

const faqEntries =[
  {
    "question": "Come si chiama il liquore siciliano?",
    "description": "Come si chiama il liquore siciliano? Limoncello Il Limoncello o Lemoncello di Sicilia di Bomapi è un liquore artigianale, tipico siciliano, realizzato con le migliori scorze dei limoni siciliani maturati sotto il sole della nostra amata terra. Liquori Tipici Siciliani",
    "searchQuery": "liquori siciliani"
  }
];

for (const faq of faqEntries) {
 const messaggi = [
  {
    role: "user",
    content: `
Riscrivi il seguente contenuto, proveniente da una faq di google e non colelgata alla nostra azienda come articolo SEO per un blog WordPress.

Istruzioni:
- Usa il sito "${BASE_URL}" come riferimento per stile, tono e struttura degli articoli.
- Prendi il nome e i dati dell'aienda, i contatti (mail e telefono) da "${BASE_URL}" per realizzare delle CTA coinvolgenti.
- Evita di citare altre Aziende anche se presenti nelle risposte: "${faq.searchQuery}".
- Crea un titolo H1 basato sulla domanda: "${faq.question}". 
- Aggiungi un'introduzione informativa e coinvolgente.
- Suddividi l'articolo in sezioni con H2 e H3.
- Mantieni uno stile simile agli articoli presenti nel sito di riferimento.
- Utilizza la parola chiave "${faq.searchQuery}" almeno 3 volte.
- Includi HTML pronto da incollare su WordPress.

Testo da riformulare:
${faq.description}
    `.trim()
  }
];


  const chatCompletion = await client.chatCompletion({
    provider: "novita",
    model: "meta-llama/Llama-3.2-3B-Instruct",
    messages: messaggi
  });

  console.log(`📝 FAQ: ${faq.question}`);
  console.log(`📰 Articolo SEO:\n${chatCompletion.choices[0].message.content}\n`);
}
