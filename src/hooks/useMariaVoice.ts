import { useCallback, useEffect, useRef, useState } from 'react';
import { MARIA_LANGUAGES, MariaLanguageCode } from '../data/oceaneProfile';

export type VoiceConnectionState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface TranscriptEntry {
  id: string;
  speaker: 'visitor' | 'maria';
  text: string;
  isArabic: boolean;
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
  const binary = atob(base64);
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
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const isReadyRef = useRef<boolean>(false);
  const pendingTextRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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

  const teardownAudioAndSocket = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    clearScheduledAudio();

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
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

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    isReadyRef.current = false;
    setAudioLevel(0);
  }, [clearScheduledAudio]);

  useEffect(() => {
    return () => {
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

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
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
      if (activeSourcesRef.current.size === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        setConnectionState('listening');
        setAudioLevel(0);
      }
    };

    source.start(startTime);
  }, []);

  const startSession = useCallback(
    async (overrideLang?: MariaLanguageCode, initialTextPrompt?: string) => {
      const targetLang = overrideLang ?? selectedLanguage;
      if (overrideLang) {
        setSelectedLanguage(overrideLang);
      }

      teardownAudioAndSocket();
      setErrorMessage(null);
      setMicNotice(null);
      setConnectionState('connecting');
      setElapsedSeconds(0);
      setIsMuted(false);
      isMutedRef.current = false;
      pendingTextRef.current = initialTextPrompt ?? null;

      try {
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        outputCtxRef.current = outputCtx;
        if (outputCtx.state === 'suspended') {
          void outputCtx.resume();
        }

        // Request microphone softly: if unavailable or denied, continue in listen-and-type mode
        let hasMic = false;
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            inputCtxRef.current = inputCtx;
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            mediaStreamRef.current = stream;
            hasMic = true;
            setMicAvailable(true);
          } catch {
            hasMic = false;
            setMicAvailable(false);
            setIsMuted(true);
            isMutedRef.current = true;
            if (inputCtxRef.current) {
              void inputCtxRef.current.close().catch(() => {});
              inputCtxRef.current = null;
            }
            setMicNotice(
              'Microphone unavailable — Maria is active in listen-only mode. Click any prompt or type below to hear her respond.'
            );
          }
        } else {
          hasMic = false;
          setMicAvailable(false);
          setIsMuted(true);
          isMutedRef.current = true;
          setMicNotice(
            'Microphone unavailable — Maria is active in listen-only mode. Click any prompt or type below to hear her respond.'
          );
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/live?lang=${encodeURIComponent(targetLang)}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
          if (!hasMic || !inputCtxRef.current || !mediaStreamRef.current) return;
          if (inputCtxRef.current.state === 'suspended') {
            void inputCtxRef.current.resume();
          }

          const source = inputCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
          const processor = inputCtxRef.current.createScriptProcessor(4096, 1, 1);
          sourceNodeRef.current = source;
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(inputCtxRef.current.destination);

          processor.onaudioprocess = (event) => {
            if (isMutedRef.current || !isReadyRef.current) return;
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

            const channel = event.inputBuffer.getChannelData(0);
            if (activeSourcesRef.current.size === 0) {
              let sum = 0;
              for (let i = 0; i < channel.length; i += 32) {
                sum += Math.abs(channel[i]);
              }
              const level = Math.min(1, (sum / (channel.length / 32)) * 4.2);
              setAudioLevel((prev) => prev * 0.6 + level * 0.4);
            }

            const base64 = pcmFloat32ToBase64(channel);
            wsRef.current.send(JSON.stringify({ audio: base64 }));
          };
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as {
              ready?: boolean;
              audio?: string;
              inputTranscript?: string;
              outputTranscript?: string;
              interrupted?: boolean;
              turnComplete?: boolean;
              sessionClosed?: boolean;
              error?: string;
            };

            if (msg.error) {
              setErrorMessage(msg.error);
              setConnectionState('error');
              teardownAudioAndSocket();
              return;
            }

            if (msg.ready) {
              isReadyRef.current = true;
              setConnectionState('listening');
              timerRef.current = window.setInterval(() => {
                setElapsedSeconds((s) => s + 1);
              }, 1000);

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
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onerror = () => {
          setErrorMessage('Unable to reach the voice assistant service. Please try again.');
          setConnectionState('error');
          teardownAudioAndSocket();
        };

        ws.onclose = () => {
          setConnectionState((prev) => (prev === 'error' ? 'error' : 'idle'));
          teardownAudioAndSocket();
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unable to start voice session.';
        setErrorMessage(message);
        setConnectionState('error');
        teardownAudioAndSocket();
      }
    },
    [
      appendTranscript,
      clearScheduledAudio,
      playPcmChunk,
      selectedLanguage,
      teardownAudioAndSocket,
    ]
  );

  const stopSession = useCallback(() => {
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

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isReadyRef.current) {
        appendTranscript('visitor', trimmed);
        wsRef.current.send(JSON.stringify({ text: trimmed }));
      } else {
        void startSession(selectedLanguage, trimmed);
      }
    },
    [appendTranscript, selectedLanguage, startSession]
  );

  const switchLanguage = useCallback((lang: MariaLanguageCode) => {
    setSelectedLanguage(lang);
    const langObj = MARIA_LANGUAGES.find((l) => l.code === lang);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isReadyRef.current && langObj) {
      wsRef.current.send(
        JSON.stringify({
          text: `Please switch our conversation to ${langObj.label} now and briefly acknowledge in ${langObj.label}.`,
        })
      );
    }
  }, []);

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
