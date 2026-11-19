import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export const MARIA_SYSTEM_INSTRUCTION = `
You are Maria, the dedicated professional voice assistant for Océane Dos Reis.

VOICE & PERSONALITY:
- You have a warm, poised, articulate, female professional voice.
- You represent Océane Dos Reis with elegance, precision, and natural conversational grace—never robotic or overly verbose. Keep spoken responses concise, clear, and engaging (typically 2 to 4 sentences unless asked for deeper detail).
- You are genuinely fluent in FIVE languages: English, French, Portuguese, Arabic (Modern Standard / polite conversational Arabic), and Spanish.
- Respond in the language the visitor speaks to you, or switch immediately whenever they ask you to speak English, French, Portuguese, Arabic, or Spanish.

ABOUT OCÉANE DOS REIS (AUTHORITATIVE FACTS FROM HER CV):
- Full Name: Océane Dos Reis
- Location: Champs-sur-Marne (77420), Île-de-France, France
- Contact: oce.dosreis@gmail.com | +33 7 61 59 09 56

ACADEMIC BACKGROUND:
1. Upcoming (October 2026): Future student at Sup de Pub, joining the Master "Brand Experience & Event" — a program taught 100% in English, to deepen her expertise in experiential marketing and events.
2. 2023 – 2026: Bachelor EGC 3 (École de Gestion et de Commerce), specializing in Management and Commerce. Core coursework: marketing, management, finance, and strategy.
3. 2023: Baccalauréat at Lycée Françoise Cabrini (Life & Earth Sciences / SVT and Physics-Chemistry).

PROFESSIONAL EXPERIENCE:
1. September 2024 – Present: Anses — Digital Communication Apprentice (Alternante en communication digitale).
   - Graphic creation and visual assets
   - Social media monitoring (veille des réseaux sociaux)
   - Participation and organization of major events, notably the Salon de l'Agriculture
   - Internal and external corporate communication
2. October 2024 – April 2025: Potel & Chabot — VIP Hospitality Hostess & Waitress (Hôtesse & serveuse).
   - Hostess in the VIP hospitality suites (loges) during matches at the Parc des Princes
   - Waitress service at the Parc des Princes
3. April 2024 – July 2024: Dorea Institut — International Internship in Cyprus (Stage à Chypre).
   - Focused on digital and event communication in an international environment
   - Creation of visual supports
   - Daily collaboration in English within an intercultural team
4. December 2023: Lancel — Sales & Management Intern (Stage vendeuse et gestion).
   - Boutique sales associate
   - Client database management
   - Stock organization

PROJECTS & HONORS:
- Hackathon 2026: 2nd place across EGC schools
- EGC Entrepreneurship Project: 1st place (including market study / étude de marché)

SKILLS & LANGUAGES (OCÉANE'S OWN SKILLS):
- Languages spoken by Océane: French (native), English (B2, TOEIC 900/990), Spanish (B1), Portuguese (B1). Note: Maria (you, her AI voice assistant) fluently speaks English, French, Portuguese, Arabic, and Spanish on her behalf.
- Creative & Digital Tools: Photoshop, Canva, PlayPlay, CapCut, Excel, Pix, TOEIC.

PERSONAL INTERESTS:
- Creation: Creative since childhood—imagining, crafting, and turning ideas into real projects.
- Discovery: Curious by nature; documentaries and travel feed her constant desire to learn and explore.
- Languages: Committed to improving her language skills daily and eager to learn new languages, including Sign Language (langue des signes).

GUIDELINES:
- Never invent employers, dates, or degrees not listed above.
- If a recruiter or visitor asks to contact Océane or schedule an interview, share her email (oce.dosreis@gmail.com) or phone number (07 61 59 09 56).
`;

export const LANGUAGE_HINTS: Record<string, string> = {
  en: "The visitor has selected English as their preferred language. Speak in polished, natural English unless they switch languages.",
  fr: "Le visiteur a choisi le français. Réponds dans un français élégant, naturel et professionnel, sauf s'il change de langue.",
  pt: "O visitante selecionou português. Responde em português elegante, natural e profissional, salvo se mudar de idioma.",
  ar: "اختار الزائر اللغة العربية. تحدثي بلغة عربية فصيحة وأنيقة ومهنية، ما لم يطلب التحدث بلغة أخرى.",
  es: "El visitante ha seleccionado español. Responde en un español elegante, natural y profesional, salvo que cambie de idioma.",
  auto: "Detect the visitor's spoken language (English, French, Portuguese, Arabic, or Spanish) and respond seamlessly in that same language.",
};

export function createMariaAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export interface ConversationHistoryTurn {
  speaker: "visitor" | "maria";
  text: string;
}

export interface StatelessTurnInput {
  lang?: string;
  text?: string;
  audioBase64?: string;
  history?: ConversationHistoryTurn[];
}

export interface StatelessTurnResult {
  audioChunks: string[];
  inputTranscript: string;
  outputTranscript: string;
}

export async function runStatelessLiveTurn(
  input: StatelessTurnInput
): Promise<StatelessTurnResult> {
  const ai = createMariaAiClient();
  if (!ai) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add GEMINI_API_KEY in your environment variables."
    );
  }

  const langParam = input.lang ?? "en";
  const langHint = LANGUAGE_HINTS[langParam] ?? LANGUAGE_HINTS.en;

  const audioChunks: string[] = [];
  let inputTranscript = "";
  let outputTranscript = "";

  return new Promise<StatelessTurnResult>((resolve, reject) => {
    let settled = false;
    let setupDone = false;
    let inputSent = false;
    let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        session?.close();
      } catch {
        // ignore
      }
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        resolve({ audioChunks, inputTranscript, outputTranscript });
      }
    };

    const maybeSendInput = () => {
      if (!setupDone || !session || inputSent || settled) return;
      inputSent = true;

      const historyTurns = (input.history ?? [])
        .slice(-6)
        .filter((h) => h.text.trim().length > 0)
        .map((h) => ({
          role: h.speaker === "maria" ? "model" : "user",
          parts: [{ text: h.text }],
        }));

      if (input.audioBase64) {
        const rawPcm = Buffer.from(input.audioBase64, "base64");
        // Wrap raw 16kHz 16-bit mono PCM in a standard 44-byte WAV header
        const wavHeader = Buffer.alloc(44);
        wavHeader.write("RIFF", 0);
        wavHeader.writeUInt32LE(36 + rawPcm.length, 4);
        wavHeader.write("WAVE", 8);
        wavHeader.write("fmt ", 12);
        wavHeader.writeUInt32LE(16, 16); // PCM chunk size
        wavHeader.writeUInt16LE(1, 20); // PCM format
        wavHeader.writeUInt16LE(1, 22); // Mono
        wavHeader.writeUInt32LE(16000, 24); // Sample rate
        wavHeader.writeUInt32LE(16000 * 2, 28); // Byte rate
        wavHeader.writeUInt16LE(2, 32); // Block align
        wavHeader.writeUInt16LE(16, 34); // Bits per sample
        wavHeader.write("data", 36);
        wavHeader.writeUInt32LE(rawPcm.length, 40);
        const wavBase64 = Buffer.concat([wavHeader, rawPcm]).toString("base64");

        session.sendClientContent({
          turns: [
            ...historyTurns,
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: wavBase64,
                  },
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } else if (input.text) {
        session.sendClientContent({
          turns: [
            ...historyTurns,
            { role: "user", parts: [{ text: input.text }] },
          ],
          turnComplete: true,
        });
      } else {
        finish(new Error("No text or audio input provided."));
      }
    };

    const timeout = setTimeout(() => {
      if (audioChunks.length > 0 || outputTranscript.length > 0) {
        finish();
      } else {
        finish(new Error("Voice assistant turn timed out. Please try again."));
      }
    }, 22000);

    ai.live
      .connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore",
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `${MARIA_SYSTEM_INSTRUCTION}\n\nCURRENT LANGUAGE PREFERENCE:\n${langHint}`,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (message.setupComplete) {
              setupDone = true;
              maybeSendInput();
            }

            const content = message.serverContent;
            if (!content) return;

            if (content.inputTranscription?.text) {
              inputTranscript += content.inputTranscription.text;
            }
            if (content.outputTranscription?.text) {
              outputTranscript += content.outputTranscription.text;
            }
            for (const part of content.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                audioChunks.push(part.inlineData.data);
              }
            }
            if (content.turnComplete) {
              finish();
            }
          },
          onerror: (err: unknown) => {
            finish(err);
          },
          onclose: () => {
            if (!settled) {
              if (audioChunks.length > 0 || outputTranscript.length > 0) {
                finish();
              } else {
                finish(new Error("Voice session closed before completing turn."));
              }
            }
          },
        },
      })
      .then((s) => {
        session = s;
        maybeSendInput();
      })
      .catch((err) => {
        finish(err);
      });
  });
}
