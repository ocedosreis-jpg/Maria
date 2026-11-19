import React, { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { OCEANE_PROFILE } from '../data/oceaneProfile';

interface CvModalProps {
  open: boolean;
  onClose: () => void;
}

export const CvModal: React.FC<CvModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060509]/80 backdrop-blur-md p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Océane Dos Reis Curriculum Vitae"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] bg-[#15131C] border border-[#F7EFE2]/15 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#F7EFE2]/10 bg-[#1C1824]">
          <div>
            <h3 className="font-serif text-xl font-medium text-[#F7EFE2]">
              Océane Dos Reis — Curriculum Vitae
            </h3>
            <p className="text-xs text-[#B8ADA0]">
              Champs-sur-Marne · Master Brand Experience &amp; Event Candidate
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={OCEANE_PROFILE.cvPath}
              download="CV_Oceane_Dos_Reis.pdf"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#E8A849] to-[#D94B64] text-[#0C0B10] text-xs font-semibold hover:brightness-110 transition-all whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close CV preview"
              className="p-2 rounded-full text-[#F7EFE2] hover:bg-[#F7EFE2]/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#0C0B10]">
          <iframe
            src={OCEANE_PROFILE.cvPath}
            title="Océane Dos Reis CV PDF"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
};
