import React from 'react';
import { VoiceConnectionState } from '../hooks/useMariaVoice';

interface AcousticWaveProps {
  level: number;
  state: VoiceConnectionState;
}

const BAR_WEIGHTS = [
  0.26, 0.42, 0.65, 0.9, 0.54, 0.82, 1.0, 0.72, 0.92, 0.62, 0.86, 0.48, 0.76, 0.52, 0.32,
  0.6, 0.84, 0.44, 0.28,
];

export const AcousticWave: React.FC<AcousticWaveProps> = ({ level, state }) => {
  const isActive = state === 'listening' || state === 'speaking';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const effectiveLevel =
    state === 'connecting' ? 0.28 : isActive ? Math.max(0.16, level) : 0.08;

  return (
    <div
      className="relative flex items-center justify-center gap-[5px] h-16 px-5"
      aria-hidden="true"
    >
      {BAR_WEIGHTS.map((weight, idx) => {
        const dynamicScale = isActive
          ? 0.22 + effectiveLevel * weight * (isSpeaking ? 1.0 : 0.8)
          : 0.16 + weight * 0.08;
        const clamped = Math.min(1, Math.max(0.14, dynamicScale));

        const barColorClass = isSpeaking
          ? idx % 3 === 0
            ? 'bg-gradient-to-t from-[#D94B64] to-[#E8A849]'
            : 'bg-gradient-to-t from-[#E8A849] to-[#F7EFE2]'
          : isListening
          ? idx % 2 === 0
            ? 'bg-gradient-to-t from-[#4E7DF2] to-[#98B7FF]'
            : 'bg-gradient-to-t from-[#4E7DF2] to-[#E8A849]'
          : 'bg-gradient-to-t from-[#D94B64]/35 via-[#E8A849]/40 to-[#F7EFE2]/30';

        return (
          <span
            key={idx}
            className={`w-[2.5px] rounded-full transition-transform duration-150 ease-out origin-center ${barColorClass}`}
            style={{
              height: '52px',
              transform: `scaleY(${clamped.toFixed(3)})`,
            }}
          />
        );
      })}
    </div>
  );
};
