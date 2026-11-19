import "dotenv/config";
import express from "express";
import { createServer as createHttpServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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

function createAiClient() {
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

type LiveSession = Awaited<ReturnType<GoogleGenAI["live"]["connect"]>>;

async function openMariaLiveSession(
  langParam: string,
  emit: (payload: Record<string, unknown>) => void,
  isClosed: () => boolean
): Promise<LiveSession> {
  const ai = createAiClient();
  if (!ai) {
    throw new Error(
      "Gemini API key is missing. Please configure GEMINI_API_KEY in Settings > Secrets."
    );
  }

  const langHint = LANGUAGE_HINTS[langParam] ?? LANGUAGE_HINTS.en;
  let readySent = false;

  const emitReady = () => {
    if (!readySent && !isClosed()) {
      readySent = true;
      emit({ ready: true, language: langParam });
    }
  };

  const session = await ai.live.connect({
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
      onopen: () => {},
      onmessage: (message: LiveServerMessage) => {
        if (message.setupComplete) {
          emitReady();
        }
        const content = message.serverContent;
        if (!content) return;

        if (content.inputTranscription?.text) {
          emit({ inputTranscript: content.inputTranscription.text });
        }

        if (content.outputTranscription?.text) {
          emit({ outputTranscript: content.outputTranscription.text });
        }

        for (const part of content.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) {
            emit({ audio: part.inlineData.data });
          }
        }

        if (content.interrupted) {
          emit({ interrupted: true });
        }

        if (content.turnComplete) {
          emit({ turnComplete: true });
        }
      },
      onerror: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : "An error occurred with the Gemini Live session.";
        emit({ error: message });
      },
      onclose: () => {
        if (!isClosed()) {
          emit({ sessionClosed: true });
        }
      },
    },
  });

  return session;
}

function forwardInputToSession(
  session: LiveSession,
  msg: { audio?: string; text?: string }
) {
  if (msg.audio) {
    session.sendRealtimeInput({
      audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
    });
  } else if (msg.text) {
    session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: msg.text }] }],
      turnComplete: true,
    });
  }
}

function sendWsJson(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

interface HttpLiveBridge {
  session: LiveSession | null;
  closed: boolean;
  close: () => void;
}

const httpLiveSessions = new Map<string, HttpLiveBridge>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // SSE + HTTP POST Live Bridge fallback when WebSocket upgrades are blocked by a proxy
  app.get("/api/live/stream", async (req, res) => {
    const sessionId = String(req.query.sessionId ?? "").trim();
    const langParam = String(req.query.lang ?? "en");

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const existing = httpLiveSessions.get(sessionId);
    if (existing) {
      existing.close();
      httpLiveSessions.delete(sessionId);
    }

    const bridge: HttpLiveBridge = {
      session: null,
      closed: false,
      close: () => {
        if (bridge.closed) return;
        bridge.closed = true;
        clearInterval(keepAlive);
        try {
          bridge.session?.close();
        } catch {
          // ignore
        }
        bridge.session = null;
        if (!res.writableEnded) {
          res.end();
        }
      },
    };

    const keepAlive = setInterval(() => {
      if (!bridge.closed && !res.writableEnded) {
        res.write(": keepalive\n\n");
      }
    }, 15000);

    const emitSse = (payload: Record<string, unknown>) => {
      if (!bridge.closed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    httpLiveSessions.set(sessionId, bridge);

    req.on("close", () => {
      bridge.close();
      httpLiveSessions.delete(sessionId);
    });

    try {
      const session = await openMariaLiveSession(
        langParam,
        emitSse,
        () => bridge.closed
      );
      if (bridge.closed) {
        try {
          session.close();
        } catch {
          // ignore
        }
        return;
      }
      bridge.session = session;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to establish Gemini Live voice session.";
      emitSse({ error: message });
      bridge.close();
      httpLiveSessions.delete(sessionId);
    }
  });

  app.post("/api/live/input", (req, res) => {
    const { sessionId, audio, text } = (req.body ?? {}) as {
      sessionId?: string;
      audio?: string;
      text?: string;
    };
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }
    const bridge = httpLiveSessions.get(sessionId);
    if (!bridge || bridge.closed || !bridge.session) {
      res.status(404).json({ error: "Live session not active" });
      return;
    }
    try {
      forwardInputToSession(bridge.session, { audio, text });
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to send input",
      });
    }
  });

  app.post("/api/live/close", (req, res) => {
    const { sessionId } = (req.body ?? {}) as { sessionId?: string };
    if (sessionId) {
      const bridge = httpLiveSessions.get(sessionId);
      if (bridge) {
        bridge.close();
        httpLiveSessions.delete(sessionId);
      }
    }
    res.json({ ok: true });
  });

  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const langParam = url.searchParams.get("lang") ?? "en";

    let session: LiveSession | null = null;
    let closed = false;

    const pingInterval = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping();
      }
    }, 20000);

    try {
      session = await openMariaLiveSession(
        langParam,
        (payload) => sendWsJson(clientWs, payload),
        () => closed
      );
      if (closed) {
        try {
          session.close();
        } catch {
          // ignore
        }
        return;
      }
    } catch (err: unknown) {
      clearInterval(pingInterval);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to establish Gemini Live voice session.";
      sendWsJson(clientWs, { error: message });
      clientWs.close(1011, "Live connect failed");
      return;
    }

    clientWs.on("message", (raw) => {
      if (!session || closed) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          audio?: string;
          text?: string;
        };
        forwardInputToSession(session, msg);
      } catch (err) {
        console.error("Failed to forward client message to Live session:", err);
      }
    });

    clientWs.on("close", () => {
      closed = true;
      clearInterval(pingInterval);
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
  process.exit(1);
});
