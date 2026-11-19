import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, RotateCcw, Send, Volume2 } from 'lucide-react';
import { MARIA_LANGUAGES, MariaLanguageCode } from '../data/oceaneProfile';
import { TranscriptEntry, VoiceConnectionState } from '../hooks/useMariaVoice';
import { AcousticWave } from './AcousticWave';

interface MariaStudioProps {
  selectedLanguage: MariaLanguageCode;
  connectionState: VoiceConnectionState;
  isMuted: boolean;
  micAvailable: boolean;
  micNotice: string | null;
  errorMessage: string | null;
  transcript: TranscriptEntry[];
  audioLevel: number;
  elapsedSeconds: number;
  onStart: (lang?: MariaLanguageCode, initialPrompt?: string) => void;
  onStop: () => void;
  onToggleMute: () => void;
  onSendText: (text: string) => void;
  onSwitchLanguage: (lang: MariaLanguageCode) => void;
  onClearTranscript: () => void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MariaStudio: React.FC<MariaStudioProps> = ({
  selectedLanguage,
  connectionState,
  isMuted,
  micAvailable,
  micNotice,
  errorMessage,
  transcript,
  audioLevel,
  elapsedSeconds,
  onStart,
  onStop,
  onToggleMute,
  onSendText,
  onSwitchLanguage,
  onClearTranscript,
}) => {
  const [draft, setDraft] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const activeLang =
    MARIA_LANGUAGES.find((l) => l.code === selectedLanguage) ?? MARIA_LANGUAGES[0];

  const isLive =
    connectionState === 'connecting' ||
    connectionState === 'listening' ||
    connectionState === 'speaking';

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [transcript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendText(draft);
    setDraft('');
  };

  const stateLabel =
    connectionState === 'connecting'
      ? 'Connecting'
      : connectionState === 'speaking'
      ? 'Maria speaking'
      : connectionState === 'listening'
      ? !micAvailable
        ? 'Connected · Listen mode'
        : isMuted
        ? 'Microphone muted'
        : 'Listening'
      : connectionState === 'error'
      ? 'Connection issue'
      : 'Ready to converse';

  return (
    <div
      id="maria-studio"
      className="relative overflow-hidden flex flex-col justify-between h-full bg-[#15131C]/90 backdrop-blur-xl border border-[#F7EFE2]/12 rounded-2xl p-6 sm:p-7 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.85)]"
    >
      {/* Dynamic Cinematic Stage Spotlight */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[380px] h-[240px] rounded-full blur-[90px] transition-opacity duration-500 ${
          connectionState === 'speaking'
            ? 'bg-gradient-to-r from-[#E8A849]/35 via-[#D94B64]/35 to-[#E8A849]/30 opacity-100'
            : connectionState === 'listening'
            ? 'bg-gradient-to-r from-[#4E7DF2]/30 via-[#98B7FF]/20 to-[#E8A849]/25 opacity-95'
            : 'bg-gradient-to-r from-[#D94B64]/20 via-[#E8A849]/20 to-[#4E7DF2]/15 opacity-75'
        }`}
      />

      {/* Top Studio Header */}
      <div className="relative flex items-start justify-between gap-4 pb-5 border-b border-[#F7EFE2]/10">
        <div>
          <p className="text-xs tracking-wide text-[#B8ADA0]">
            Voice Concierge · Female Professional Voice
          </p>
          <h2 className="mt-1 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#F7EFE2]">
            Maria
          </h2>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-[#B8ADA0] tabular-nums pt-1">
          {(connectionState === 'listening' || connectionState === 'speaking') && (
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connectionState === 'speaking' ? 'bg-[#E8A849]' : 'bg-[#4E7DF2]'
              }`}
              aria-hidden="true"
            />
          )}
          <span className="whitespace-nowrap text-[#F7EFE2]/90">{stateLabel}</span>
          {isLive && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-[#E8A849]">
                {formatDuration(elapsedSeconds)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 5-Language Segmented Control */}
      <div className="relative py-4 border-b border-[#F7EFE2]/10">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs text-[#B8ADA0]">Fluent conversation language</span>
          {transcript.length > 0 && (
            <button
              type="button"
              onClick={onClearTranscript}
              className="inline-flex items-center gap-1 text-xs text-[#B8ADA0] hover:text-[#F7EFE2] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Select Maria conversation language"
        >
          {MARIA_LANGUAGES.map((lang) => {
            const active = lang.code === selectedLanguage;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onSwitchLanguage(lang.code)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8A849] ${
                  active
                    ? 'bg-gradient-to-r from-[#E8A849] to-[#D94B64] text-[#0C0B10] font-semibold shadow-sm'
                    : 'bg-[#1F1C2A] text-[#F7EFE2]/80 hover:bg-[#2A2538] hover:text-[#F7EFE2]'
                }`}
              >
                {lang.nativeLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Acoustic Centerpiece & Controls */}
      <div className="relative py-5 flex flex-col items-center justify-center border-b border-[#F7EFE2]/10">
        <AcousticWave level={audioLevel} state={connectionState} />

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {!isLive ? (
            <button
              type="button"
              onClick={() => onStart(selectedLanguage)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-[#E8A849] via-[#E57C54] to-[#D94B64] text-[#0C0B10] text-sm font-semibold hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8A849]"
            >
              <Mic className="w-4 h-4" />
              <span>Speak with Maria</span>
            </button>
          ) : (
            <>
              {micAvailable && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isMuted
                      ? 'bg-[#2A2538] border-[#E8A849]/50 text-[#E8A849]'
                      : 'bg-[#1F1C2A] border-[#F7EFE2]/20 text-[#F7EFE2] hover:bg-[#2A2538]'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D94B64] text-[#F7EFE2] text-xs font-semibold hover:bg-[#E25C74] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Session</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mic Notice (Non-blocking listen-only mode) */}
      {micNotice && !errorMessage && (
        <div className="relative mt-4 px-4 py-2.5 rounded-xl bg-[#1F1C2A] border border-[#E8A849]/30 text-xs text-[#F7EFE2]/90">
          {micNotice}
        </div>
      )}

      {/* Error State */}
      {errorMessage && (
        <div
          role="alert"
          className="relative mt-4 px-4 py-3 rounded-xl bg-[#2B1721] border border-[#D94B64]/45 text-xs text-[#F7EFE2]"
        >
          <p className="font-semibold text-[#F6A5B3]">Voice session notice</p>
          <p className="mt-1 text-[#F7EFE2]/85">{errorMessage}</p>
        </div>
      )}

      {/* Live Transcript or Suggested Starters */}
      <div className="relative pt-4 flex-1 flex flex-col justify-between min-h-[195px]">
        {transcript.length === 0 ? (
          <div className="space-y-2.5" dir={activeLang.dir}>
            <p className="text-xs text-[#B8ADA0]">
              {activeLang.code === 'ar'
                ? 'اضغطي على سؤال للبدء بالمحادثة الصوتية:'
                : activeLang.code === 'fr'
                ? 'Cliquez sur une suggestion pour entendre Maria :'
                : activeLang.code === 'pt'
                ? 'Selecione uma pergunta para ouvir a Maria:'
                : activeLang.code === 'es'
                ? 'Elige una pregunta para escuchar a Maria:'
                : 'Select a prompt to hear Maria respond:'}
            </p>
            <div className="flex flex-col gap-1.5">
              {activeLang.samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendText(prompt)}
                  className="w-full text-start px-3.5 py-2.5 rounded-xl bg-[#1F1C2A]/90 hover:bg-[#2A2538] border border-[#F7EFE2]/6 hover:border-[#E8A849]/35 text-xs text-[#F7EFE2]/90 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="leading-relaxed">{prompt}</span>
                  <Volume2 className="w-3.5 h-3.5 text-[#E8A849] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto pr-1 space-y-3 text-sm">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                dir={entry.isArabic ? 'rtl' : 'ltr'}
                className="leading-relaxed"
              >
                <span
                  className={`text-[11px] font-semibold block mb-0.5 ${
                    entry.speaker === 'maria' ? 'text-[#E8A849]' : 'text-[#89A9FF]'
                  }`}
                >
                  {entry.speaker === 'maria' ? 'Maria' : 'You'}
                </span>
                <p className="text-[13px] text-[#F7EFE2]/92">{entry.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Text Prompt Input */}
        <form
          onSubmit={handleSubmit}
          className="mt-4 pt-3 border-t border-[#F7EFE2]/10 flex items-center gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            dir={activeLang.dir}
            placeholder={
              activeLang.code === 'ar'
                ? 'اكتب سؤالاً لماريا...'
                : activeLang.code === 'fr'
                ? 'Posez une question à Maria...'
                : activeLang.code === 'pt'
                ? 'Escreva uma pergunta para Maria...'
                : activeLang.code === 'es'
                ? 'Escribe una pregunta para Maria...'
                : 'Ask Maria anything about Océane...'
            }
            className="flex-1 min-w-0 bg-transparent text-sm text-[#F7EFE2] placeholder:text-[#B8ADA0]/65 focus:outline-none py-1.5"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message to Maria"
            className="p-2 rounded-full bg-[#E8A849] text-[#0C0B10] disabled:opacity-30 hover:brightness-110 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
