import { useCallback, useEffect, useRef, useState } from 'react';
import { MARIA_LANGUAGES, MariaLanguageCode } from '../data/oceaneProfile';

export type VoiceConnectionState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface TranscriptEntry {
  id: string;
  speaker: 'visitor' | 'maria';
  text: string;
  isArabic: boolean;
}

interface LiveBridgeEvent {
  ready?: boolean;
  audio?: string;
  inputTranscript?: string;
  outputTranscript?: string;
  interrupted?: boolean;
  turnComplete?: boolean;
  sessionClosed?: boolean;
  error?: string;
}

const TARGET_INPUT_SAMPLE_RATE = 16000;
const TARGET_OUTPUT_SAMPLE_RATE = 24000;

function resampleFloat32(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate || input.length === 0) {
    return input;
  }
  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, input.length - 1);
    const frac = srcIndex - low;
    output[i] = input[low] * (1 - frac) + input[high] * frac;
  }
  return output;
}

function concatFloat32Arrays(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function pcmFloat32ToBase64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToFloat32Pcm(base64: string): Float32Array {
  const normalized = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s+/g, '');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function formatMicErrorNotice(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was blocked. Allow microphone access in your browser settings to speak verbally, or type/click a prompt below.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was detected. Maria is active in listen-only mode — click any prompt or type below.';
  }
  return 'Microphone unavailable here — Maria is active in listen-only mode. Click any prompt or type below to hear her respond.';
}

export function useMariaVoice() {
  const [selectedLanguage, setSelectedLanguage] = useState<MariaLanguageCode>('en');
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const transportModeRef = useRef<'ws' | 'rest' | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const isReadyRef = useRef<boolean>(false);
  const pendingTextRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<number>(0);
  const selectedLangRef = useRef<MariaLanguageCode>('en');
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  // Stateless Vercel turn VAD state
  const restTurnInFlightRef = useRef<boolean>(false);
  const preRollChunksRef = useRef<Float32Array[]>([]);
  const speechChunksRef = useRef<Float32Array[]>([]);
  const isSpeakingVadRef = useRef<boolean>(false);
  const silenceMsRef = useRef<number>(0);
  const speechMsRef = useRef<number>(0);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    selectedLangRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const clearVadBuffers = useCallback(() => {
    preRollChunksRef.current = [];
    speechChunksRef.current = [];
    isSpeakingVadRef.current = false;
    silenceMsRef.current = 0;
    speechMsRef.current = 0;
  }, []);

  const clearScheduledAudio = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const closeTransportsOnly = useCallback(() => {
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    }

    transportModeRef.current = null;
    isReadyRef.current = false;
    restTurnInFlightRef.current = false;
  }, []);

  const teardownAudioAndSocket = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    clearScheduledAudio();
    closeTransportsOnly();
    clearVadBuffers();

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (silentGainRef.current) {
      try {
        silentGainRef.current.disconnect();
      } catch {
        // ignore
      }
      silentGainRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    setAudioLevel(0);
  }, [clearScheduledAudio, clearVadBuffers, closeTransportsOnly]);

  useEffect(() => {
    return () => {
      sessionTokenRef.current += 1;
      teardownAudioAndSocket();
    };
  }, [teardownAudioAndSocket]);

  const appendTranscript = useCallback((speaker: 'visitor' | 'maria', chunk: string) => {
    if (!chunk) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        const mergedText = last.text + chunk;
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            text: mergedText,
            isArabic: containsArabic(mergedText),
          },
        ];
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          speaker,
          text: chunk,
          isArabic: containsArabic(chunk),
        },
      ];
    });
  }, []);

  const appendFullTurnTranscript = useCallback((speaker: 'visitor' | 'maria', text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTranscript((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        speaker,
        text: trimmed,
        isArabic: containsArabic(trimmed),
      },
    ]);
  }, []);

  const playPcmChunk = useCallback((base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const float32 = base64ToFloat32Pcm(base64Audio);
    if (float32.length === 0) return;

    let sum = 0;
    const step = Math.max(1, Math.floor(float32.length / 48));
    for (let i = 0; i < float32.length; i += step) {
      sum += Math.abs(float32[i]);
    }
    const avg = sum / Math.ceil(float32.length / step);
    setAudioLevel(Math.min(1, avg * 3.8));

    const audioBuffer = ctx.createBuffer(1, float32.length, TARGET_OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(new Float32Array(float32), 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.01, nextStartTimeRef.current);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    setConnectionState('speaking');

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0 && isReadyRef.current) {
        setConnectionState('listening');
        setAudioLevel(0);
      }
    };

    source.start(startTime);
  }, []);

  const sendRestTurn = useCallback(
    async (
      payload: { text?: string; audioBase64?: string },
      token: number,
      langOverride?: MariaLanguageCode
    ) => {
      if (sessionTokenRef.current !== token) return;
      restTurnInFlightRef.current = true;
      setConnectionState('connecting');

      try {
        const res = await fetch('/api/converse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: langOverride ?? selectedLangRef.current,
            text: payload.text,
            audioBase64: payload.audioBase64,
            history: transcriptRef.current.slice(-6).map((t) => ({
              speaker: t.speaker,
              text: t.text,
            })),
          }),
        });

        const rawText = await res.text();
        let data: {
          audioChunks?: string[];
          inputTranscript?: string;
          outputTranscript?: string;
          error?: string;
        } = {};
        if (rawText) {
          try {
            data = JSON.parse(rawText) as typeof data;
          } catch {
            throw new Error(
              res.status === 404
                ? 'Voice API endpoint (/api/converse) returned 404. Ensure the /api folder is deployed to Vercel and GEMINI_API_KEY is set in Environment Variables.'
                : res.ok
                ? 'Unexpected non-JSON response from voice service.'
                : `Voice service returned status ${res.status}. Please check server logs or GEMINI_API_KEY.`
            );
          }
        }

        if (sessionTokenRef.current !== token) return;

        if (!res.ok || data.error) {
          throw new Error(data.error ?? 'Unable to reach the voice assistant service.');
        }

        if (payload.audioBase64) {
          appendFullTurnTranscript(
            'visitor',
            data.inputTranscript?.trim() ? data.inputTranscript : 'Voice message'
          );
        }

        if (data.outputTranscript) {
          appendFullTurnTranscript('maria', data.outputTranscript);
        }

        if (data.audioChunks && data.audioChunks.length > 0) {
          for (const chunk of data.audioChunks) {
            playPcmChunk(chunk);
          }
        } else {
          setConnectionState('listening');
        }
      } catch (err: unknown) {
        if (sessionTokenRef.current !== token) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to reach the voice assistant service. Please try again.'
        );
        setConnectionState('error');
        teardownAudioAndSocket();
      } finally {
        restTurnInFlightRef.current = false;
      }
    },
    [appendFullTurnTranscript, playPcmChunk, teardownAudioAndSocket]
  );

  const attachMicProcessor = useCallback(
    (token: number) => {
      const ctx = inputCtxRef.current;
      const stream = mediaStreamRef.current;
      if (!ctx || !stream || processorRef.current) return;

      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      try {
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;

        sourceNodeRef.current = source;
        processorRef.current = processor;
        silentGainRef.current = silentGain;

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);

        processor.onaudioprocess = (event) => {
          if (isMutedRef.current || !isReadyRef.current || sessionTokenRef.current !== token) {
            return;
          }

          const rawChannel = event.inputBuffer.getChannelData(0);
          let sumSquares = 0;
          let sumAbs = 0;
          for (let i = 0; i < rawChannel.length; i++) {
            const v = rawChannel[i];
            sumSquares += v * v;
            sumAbs += Math.abs(v);
          }
          const rms = Math.sqrt(sumSquares / rawChannel.length);
          const avgAbs = sumAbs / rawChannel.length;

          if (activeSourcesRef.current.size === 0) {
            const level = Math.min(1, avgAbs * 4.8);
            setAudioLevel((prev) => prev * 0.55 + level * 0.45);
          }

          const resampled = resampleFloat32(
            rawChannel,
            ctx.sampleRate,
            TARGET_INPUT_SAMPLE_RATE
          );

          if (transportModeRef.current === 'ws') {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ audio: pcmFloat32ToBase64(resampled) }));
            }
            return;
          }

          if (transportModeRef.current === 'rest') {
            // Skip capturing while Maria is speaking or a turn request is in flight
            if (activeSourcesRef.current.size > 0 || restTurnInFlightRef.current) {
              clearVadBuffers();
              return;
            }

            const chunkMs = (resampled.length / TARGET_INPUT_SAMPLE_RATE) * 1000;
            const SPEECH_THRESHOLD = 0.015;
            const SILENCE_END_MS = 900;
            const MIN_SPEECH_MS = 320;
            const MAX_SPEECH_MS = 14000;

            if (!isSpeakingVadRef.current) {
              preRollChunksRef.current.push(resampled);
              if (preRollChunksRef.current.length > 3) {
                preRollChunksRef.current.shift();
              }
              if (rms >= SPEECH_THRESHOLD) {
                isSpeakingVadRef.current = true;
                speechChunksRef.current = [...preRollChunksRef.current];
                preRollChunksRef.current = [];
                speechMsRef.current = chunkMs;
                silenceMsRef.current = 0;
              }
            } else {
              speechChunksRef.current.push(resampled);
              speechMsRef.current += chunkMs;
              if (rms < SPEECH_THRESHOLD) {
                silenceMsRef.current += chunkMs;
              } else {
                silenceMsRef.current = 0;
              }

              if (
                (silenceMsRef.current >= SILENCE_END_MS &&
                  speechMsRef.current >= MIN_SPEECH_MS) ||
                speechMsRef.current >= MAX_SPEECH_MS
              ) {
                const combined = concatFloat32Arrays(speechChunksRef.current);
                clearVadBuffers();
                const audioBase64 = pcmFloat32ToBase64(combined);
                void sendRestTurn({ audioBase64 }, token);
              }
            }
          }
        };
      } catch (err) {
        setMicAvailable(false);
        setIsMuted(true);
        isMutedRef.current = true;
        setMicNotice(formatMicErrorNotice(err));
      }
    },
    [clearVadBuffers, sendRestTurn]
  );

  const handleBridgeMessage = useCallback(
    (msg: LiveBridgeEvent, targetLang: MariaLanguageCode, token: number) => {
      if (sessionTokenRef.current !== token) return;

      if (msg.error) {
        setErrorMessage(msg.error);
        setConnectionState('error');
        teardownAudioAndSocket();
        return;
      }

      if (msg.ready) {
        isReadyRef.current = true;
        setConnectionState('listening');
        if (timerRef.current === null) {
          timerRef.current = window.setInterval(() => {
            setElapsedSeconds((s) => s + 1);
          }, 1000);
        }

        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          if (pendingTextRef.current) {
            const promptToSend = pendingTextRef.current;
            pendingTextRef.current = null;
            appendTranscript('visitor', promptToSend);
            ws.send(JSON.stringify({ text: promptToSend }));
          } else {
            const langObj =
              MARIA_LANGUAGES.find((l) => l.code === targetLang) ?? MARIA_LANGUAGES[0];
            ws.send(JSON.stringify({ text: langObj.greetingInstruction }));
          }
        }
        return;
      }

      if (msg.interrupted) {
        clearScheduledAudio();
        setConnectionState('listening');
        return;
      }

      if (msg.inputTranscript) {
        appendTranscript('visitor', msg.inputTranscript);
      }

      if (msg.outputTranscript) {
        appendTranscript('maria', msg.outputTranscript);
      }

      if (msg.audio) {
        playPcmChunk(msg.audio);
      }

      if (msg.sessionClosed) {
        setConnectionState('idle');
        teardownAudioAndSocket();
      }
    },
    [appendTranscript, clearScheduledAudio, playPcmChunk, teardownAudioAndSocket]
  );

  const activateVercelRestMode = useCallback(
    (targetLang: MariaLanguageCode, token: number) => {
      if (sessionTokenRef.current !== token) return;

      closeTransportsOnly();
      transportModeRef.current = 'rest';
      isReadyRef.current = true;
      setConnectionState('listening');

      if (timerRef.current === null) {
        timerRef.current = window.setInterval(() => {
          setElapsedSeconds((s) => s + 1);
        }, 1000);
      }

      attachMicProcessor(token);

      if (pendingTextRef.current) {
        const promptToSend = pendingTextRef.current;
        pendingTextRef.current = null;
        appendFullTurnTranscript('visitor', promptToSend);
        void sendRestTurn({ text: promptToSend }, token, targetLang);
      } else {
        const langObj =
          MARIA_LANGUAGES.find((l) => l.code === targetLang) ?? MARIA_LANGUAGES[0];
        void sendRestTurn({ text: langObj.greetingInstruction }, token, targetLang);
      }
    },
    [
      appendFullTurnTranscript,
      attachMicProcessor,
      closeTransportsOnly,
      sendRestTurn,
    ]
  );

  const startSession = useCallback(
    async (overrideLang?: MariaLanguageCode, initialTextPrompt?: string) => {
      const targetLang = overrideLang ?? selectedLanguage;
      if (overrideLang) {
        setSelectedLanguage(overrideLang);
      }

      const token = sessionTokenRef.current + 1;
      sessionTokenRef.current = token;

      teardownAudioAndSocket();
      setErrorMessage(null);
      setMicNotice(null);
      setConnectionState('connecting');
      setElapsedSeconds(0);
      setIsMuted(false);
      isMutedRef.current = false;
      pendingTextRef.current = initialTextPrompt ?? null;

      try {
        let outputCtx: AudioContext;
        try {
          outputCtx = new AudioContext({ sampleRate: TARGET_OUTPUT_SAMPLE_RATE });
        } catch {
          outputCtx = new AudioContext();
        }
        outputCtxRef.current = outputCtx;
        if (outputCtx.state === 'suspended') {
          void outputCtx.resume();
        }

        const inputCtx = new AudioContext();
        inputCtxRef.current = inputCtx;
        if (inputCtx.state === 'suspended') {
          void inputCtx.resume();
        }

        if (navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            if (sessionTokenRef.current !== token) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            mediaStreamRef.current = stream;
            setMicAvailable(true);
          } catch (micErr) {
            if (sessionTokenRef.current !== token) return;
            setMicAvailable(false);
            setIsMuted(true);
            isMutedRef.current = true;
            if (inputCtxRef.current) {
              void inputCtxRef.current.close().catch(() => {});
              inputCtxRef.current = null;
            }
            setMicNotice(formatMicErrorNotice(micErr));
          }
        } else {
          setMicAvailable(false);
          setIsMuted(true);
          isMutedRef.current = true;
          if (inputCtxRef.current) {
            void inputCtxRef.current.close().catch(() => {});
            inputCtxRef.current = null;
          }
          setMicNotice(formatMicErrorNotice(new Error('NoMediaDevices')));
        }

        if (sessionTokenRef.current !== token) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let ws: WebSocket;
        try {
          ws = new WebSocket(
            `${protocol}//${window.location.host}/live?lang=${encodeURIComponent(targetLang)}`
          );
        } catch {
          activateVercelRestMode(targetLang, token);
          return;
        }

        wsRef.current = ws;
        transportModeRef.current = 'ws';

        let wsOpened = false;
        let switchedToRest = false;

        const fallbackToRest = () => {
          if (switchedToRest || sessionTokenRef.current !== token) return;
          switchedToRest = true;
          activateVercelRestMode(targetLang, token);
        };

        // If WebSocket handshake stalls (e.g. serverless host), switch cleanly to /api/converse
        const wsTimeout = window.setTimeout(() => {
          if (!wsOpened && sessionTokenRef.current === token && wsRef.current === ws) {
            fallbackToRest();
          }
        }, 1200);

        ws.onopen = () => {
          window.clearTimeout(wsTimeout);
          if (sessionTokenRef.current !== token || wsRef.current !== ws) return;
          wsOpened = true;
          attachMicProcessor(token);
        };

        ws.onmessage = (event) => {
          if (sessionTokenRef.current !== token || wsRef.current !== ws) return;
          try {
            const msg = JSON.parse(event.data as string) as LiveBridgeEvent;
            handleBridgeMessage(msg, targetLang, token);
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onerror = () => {
          window.clearTimeout(wsTimeout);
          if (sessionTokenRef.current !== token || wsRef.current !== ws) return;
          if (!wsOpened) {
            fallbackToRest();
            return;
          }
          setErrorMessage('Unable to reach the voice assistant service. Please try again.');
          setConnectionState('error');
          teardownAudioAndSocket();
        };

        ws.onclose = () => {
          window.clearTimeout(wsTimeout);
          if (sessionTokenRef.current !== token || wsRef.current !== ws) return;
          if (!wsOpened) {
            fallbackToRest();
            return;
          }
          setConnectionState((prev) => (prev === 'error' ? 'error' : 'idle'));
          teardownAudioAndSocket();
        };
      } catch (err: unknown) {
        if (sessionTokenRef.current !== token) return;
        const message =
          err instanceof Error ? err.message : 'Unable to start voice session.';
        setErrorMessage(message);
        setConnectionState('error');
        teardownAudioAndSocket();
      }
    },
    [
      activateVercelRestMode,
      attachMicProcessor,
      handleBridgeMessage,
      selectedLanguage,
      teardownAudioAndSocket,
    ]
  );

  const stopSession = useCallback(() => {
    sessionTokenRef.current += 1;
    teardownAudioAndSocket();
    setConnectionState('idle');
  }, [teardownAudioAndSocket]);

  const toggleMute = useCallback(() => {
    if (!micAvailable) return;
    setIsMuted((prev) => !prev);
  }, [micAvailable]);

  const sendTextMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (isReadyRef.current) {
        if (transportModeRef.current === 'ws') {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            appendTranscript('visitor', trimmed);
            ws.send(JSON.stringify({ text: trimmed }));
            return;
          }
        }
        if (transportModeRef.current === 'rest') {
          appendFullTurnTranscript('visitor', trimmed);
          void sendRestTurn({ text: trimmed }, sessionTokenRef.current);
          return;
        }
      }

      void startSession(selectedLanguage, trimmed);
    },
    [
      appendFullTurnTranscript,
      appendTranscript,
      selectedLanguage,
      sendRestTurn,
      startSession,
    ]
  );

  const switchLanguage = useCallback(
    (lang: MariaLanguageCode) => {
      setSelectedLanguage(lang);
      const langObj = MARIA_LANGUAGES.find((l) => l.code === lang);
      if (isReadyRef.current && langObj) {
        const switchPrompt = `Please switch our conversation to ${langObj.label} now and briefly acknowledge in ${langObj.label}.`;
        if (transportModeRef.current === 'ws' && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ text: switchPrompt }));
        } else if (transportModeRef.current === 'rest') {
          void sendRestTurn({ text: switchPrompt }, sessionTokenRef.current, lang);
        }
      }
    },
    [sendRestTurn]
  );

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  return {
    selectedLanguage,
    connectionState,
    isMuted,
    micAvailable,
    micNotice,
    errorMessage,
    transcript,
    audioLevel,
    elapsedSeconds,
    startSession,
    stopSession,
    toggleMute,
    sendTextMessage,
    switchLanguage,
    clearTranscript,
  };
}
