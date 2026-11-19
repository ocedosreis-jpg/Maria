import "dotenv/config";
import express from "express";
import { createServer as createHttpServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { LiveServerMessage, Modality } from "@google/genai";
import {
  createMariaAiClient,
  LANGUAGE_HINTS,
  MARIA_SYSTEM_INSTRUCTION,
  runStatelessLiveTurn,
  type ConversationHistoryTurn,
} from "./lib/mariaLive";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

type LiveSession = Awaited<
  ReturnType<NonNullable<ReturnType<typeof createMariaAiClient>>["live"]["connect"]>
>;

async function openMariaLiveSession(
  langParam: string,
  emit: (payload: Record<string, unknown>) => void,
  isClosed: () => boolean
): Promise<LiveSession> {
  const ai = createMariaAiClient();
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post("/api/converse", async (req, res) => {
    try {
      const { lang, text, audioBase64, history } = (req.body ?? {}) as {
        lang?: string;
        text?: string;
        audioBase64?: string;
        history?: ConversationHistoryTurn[];
      };

      const result = await runStatelessLiveTurn({
        lang,
        text,
        audioBase64,
        history,
      });

      res.json({
        audioChunks: result.audioChunks,
        inputTranscript: result.inputTranscript,
        outputTranscript: result.outputTranscript,
      });
    } catch (err: unknown) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "Failed to process Maria voice turn.",
      });
    }
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
