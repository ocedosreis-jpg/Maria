import type { IncomingMessage, ServerResponse } from "http";
import { runStatelessLiveTurn, type ConversationHistoryTurn } from "../lib/mariaLive";

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : undefined;
    const history = Array.isArray(body.history)
      ? (body.history as ConversationHistoryTurn[])
      : undefined;

    const result = await runStatelessLiveTurn({
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
