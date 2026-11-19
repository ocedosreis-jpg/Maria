import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const MARIA_SYSTEM_INSTRUCTION = `
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

const LANGUAGE_HINTS: Record<string, string> = {
  en: "The visitor has selected English as their preferred language. Speak in polished, natural English unless they switch languages.",
  fr: "Le visiteur a choisi le français. Réponds dans un français élégant, naturel et professionnel, sauf s'il change de langue.",
  pt: "O visitante selecionou português. Responde em português elegante, natural e profissional, salvo se mudar de idioma.",
  ar: "اختار الزائر اللغة العربية. تحدثي بلغة عربية فصيحة وأنيقة ومهنية، ما لم يطلب التحدث بلغة أخرى.",
  es: "El visitante ha seleccionado español. Responde en un español elegante, natural y profesional, salvo que cambie de idioma.",
  auto: "Detect the visitor's spoken language (English, French, Portuguese, Arabic, or Spanish) and respond seamlessly in that same language.",
};

interface ConversationHistoryTurn {
  speaker: "visitor" | "maria";
  text: string;
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string") {
    return req.body.trim() ? (JSON.parse(req.body) as Record<string, unknown>) : {};
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function buildWavBase64(pcmBase64: string): string {
  const rawPcm = Buffer.from(pcmBase64, "base64");
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + rawPcm.length, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(1, 22);
  wavHeader.writeUInt32LE(16000, 24);
  wavHeader.writeUInt32LE(16000 * 2, 28);
  wavHeader.writeUInt16LE(2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(rawPcm.length, 40);
  return Buffer.concat([wavHeader, rawPcm]).toString("base64");
}

async function runStatelessTurn(input: {
  lang: string;
  text?: string;
  audioBase64?: string;
  history?: ConversationHistoryTurn[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Please add GEMINI_API_KEY in Vercel Project Settings > Environment Variables."
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const langHint = LANGUAGE_HINTS[input.lang] ?? LANGUAGE_HINTS.en;
  const audioChunks: string[] = [];
  let inputTranscript = "";
  let outputTranscript = "";

  return new Promise<{
    audioChunks: string[];
    inputTranscript: string;
    outputTranscript: string;
  }>((resolve, reject) => {
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
        .filter((h) => h.text && h.text.trim().length > 0)
        .map((h) => ({
          role: h.speaker === "maria" ? "model" : "user",
          parts: [{ text: h.text }],
        }));

      if (input.audioBase64) {
        const wavBase64 = buildWavBase64(input.audioBase64);
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

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const lang = typeof body.lang === "string" ? body.lang : "en";
    const text = typeof body.text === "string" ? body.text : undefined;
    const audioBase64 =
      typeof body.audioBase64 === "string" ? body.audioBase64 : undefined;
    const history = Array.isArray(body.history)
      ? (body.history as ConversationHistoryTurn[])
      : undefined;

    const result = await runStatelessTurn({
      lang,
      text,
      audioBase64,
      history,
    });

    sendJson(res, 200, {
      audioChunks: result.audioChunks,
      inputTranscript: result.inputTranscript,
      outputTranscript: result.outputTranscript,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to process Maria voice turn.";
    sendJson(res, 500, { error: message });
  }
}
