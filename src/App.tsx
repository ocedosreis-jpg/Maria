import { useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { ArrowUpRight, FileText, Mail, Mic, Phone } from 'lucide-react';
import { CvModal } from './components/CvModal';
import { MariaStudio } from './components/MariaStudio';
import { OCEANE_PROFILE } from './data/oceaneProfile';
import { useMariaVoice } from './hooks/useMariaVoice';

const CHAPTER_ACCENTS = [
  'text-[#E8A849]',
  'text-[#D94B64]',
  'text-[#7AA2FF]',
  'text-[#E8A849]',
];

export default function App() {
  const [cvOpen, setCvOpen] = useState(false);

  const {
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
  } = useMariaVoice();

  const isLive =
    connectionState === 'connecting' ||
    connectionState === 'listening' ||
    connectionState === 'speaking';

  const handlePrimaryCta = () => {
    const el = document.getElementById('maria-studio');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!isLive) {
      void startSession(selectedLanguage);
    } else {
      stopSession();
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-hidden bg-[#0C0B10] text-[#F7EFE2]">
        {/* Ambient Cinema Color Wash Backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <div className="absolute -top-48 -left-32 w-[620px] h-[620px] rounded-full bg-[#D94B64]/14 blur-[150px]" />
          <div className="absolute top-16 right-[-10%] w-[580px] h-[580px] rounded-full bg-[#E8A849]/12 blur-[150px]" />
          <div className="absolute bottom-[-180px] left-[22%] w-[640px] h-[520px] rounded-full bg-[#4E7DF2]/12 blur-[160px]" />
        </div>

        {/* Top Bar Contract: 3 zones separated by gap-8 */}
        <header className="sticky top-0 z-30 bg-[#0C0B10]/82 backdrop-blur-lg border-b border-[#F7EFE2]/10">
          <div className="max-w-[1160px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
            {/* Zone 1: Single-line Wordmark */}
            <a
              href="#top"
              className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#F7EFE2] whitespace-nowrap shrink-0"
            >
              Océane Dos Reis
            </a>

            {/* Zone 2: 4 concise single-line nav links */}
            <nav
              className="hidden md:flex items-center gap-7 text-sm text-[#B8ADA0]"
              aria-label="Primary navigation"
            >
              <a
                href="#maria-studio"
                className="hover:text-[#E8A849] transition-colors whitespace-nowrap shrink-0"
              >
                Maria Voice
              </a>
              <a
                href="#experience"
                className="hover:text-[#E8A849] transition-colors whitespace-nowrap shrink-0"
              >
                Experience
              </a>
              <a
                href="#education"
                className="hover:text-[#E8A849] transition-colors whitespace-nowrap shrink-0"
              >
                Education
              </a>
              <a
                href="#contact"
                className="hover:text-[#E8A849] transition-colors whitespace-nowrap shrink-0"
              >
                Contact
              </a>
            </nav>

            {/* Zone 3: 1 primary CTA */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#E8A849] to-[#D94B64] text-[#0C0B10] text-xs font-semibold hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {isLive ? 'End Voice Session' : 'Speak with Maria'}
              </button>
            </div>
          </div>
        </header>

        <main id="top" className="relative z-10 max-w-[1160px] mx-auto px-6">
          {/* Hero Split */}
          <section className="py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-between py-2"
            >
              <div>
                <p className="text-xs sm:text-sm text-[#E8A849] tracking-wide font-medium">
                  Brand Experience · Event · Digital Communication
                </p>

                <h1 className="mt-5 font-serif text-[clamp(2.65rem,4.6vw,4.35rem)] leading-[1.03] font-normal tracking-tight text-[#F7EFE2] text-balance">
                  Meet{' '}
                  <span className="italic bg-gradient-to-r from-[#E8A849] via-[#F2B578] to-[#D94B64] bg-clip-text text-transparent">
                    Maria
                  </span>
                  , voice concierge for Océane Dos Reis.
                </h1>

                <p className="mt-6 text-[15px] sm:text-base leading-relaxed text-[#B8ADA0] max-w-[54ch]">
                  {OCEANE_PROFILE.intro}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[#B8ADA0] max-w-[54ch]">
                  Converse naturally in real time with Maria—fluent in{' '}
                  <span className="text-[#F7EFE2] font-medium">
                    English, French, Portuguese, Arabic, and Spanish
                  </span>
                  —to explore Océane’s internships, academic honors, and creative craft.
                </p>
              </div>

              <div className="mt-10 pt-8 border-t border-[#F7EFE2]/12 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={handlePrimaryCta}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-[#E8A849] via-[#E57C54] to-[#D94B64] text-[#0C0B10] text-sm font-semibold hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Mic className="w-4 h-4" />
                  <span>{isLive ? 'End Conversation' : 'Start Conversation'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCvOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#F7EFE2]/18 bg-[#15131C]/70 text-sm font-medium text-[#F7EFE2] hover:border-[#E8A849]/55 hover:text-[#E8A849] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileText className="w-4 h-4" />
                  <span>Inspect Full CV (PDF)</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6"
            >
              <MariaStudio
                selectedLanguage={selectedLanguage}
                connectionState={connectionState}
                isMuted={isMuted}
                micAvailable={micAvailable}
                micNotice={micNotice}
                errorMessage={errorMessage}
                transcript={transcript}
                audioLevel={audioLevel}
                elapsedSeconds={elapsedSeconds}
                onStart={startSession}
                onStop={stopSession}
                onToggleMute={toggleMute}
                onSendText={sendTextMessage}
                onSwitchLanguage={switchLanguage}
                onClearTranscript={clearTranscript}
              />
            </motion.div>
          </section>

          {/* Full-Width Key Highlights Strip */}
          <section
            aria-label="Key profile highlights"
            className="py-8 border-y border-[#F7EFE2]/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            <div>
              <p className="font-serif text-2xl font-medium text-[#E8A849] tabular-nums">
                October 2026
              </p>
              <p className="mt-1 text-xs text-[#B8ADA0]">
                Sup de Pub · Master Brand Experience &amp; Event (100% English)
              </p>
            </div>
            <div>
              <p className="font-serif text-2xl font-medium text-[#D94B64] tabular-nums">
                5 Languages
              </p>
              <p className="mt-1 text-xs text-[#B8ADA0]">
                Maria Live Voice · EN · FR · PT · AR · ES
              </p>
            </div>
            <div>
              <p className="font-serif text-2xl font-medium text-[#7AA2FF] tabular-nums">
                TOEIC 900 / 990
              </p>
              <p className="mt-1 text-xs text-[#B8ADA0]">
                French Native · English B2 · Spanish &amp; Portuguese B1
              </p>
            </div>
            <div>
              <p className="font-serif text-2xl font-medium text-[#F7EFE2] tabular-nums">
                1st &amp; 2nd Place
              </p>
              <p className="mt-1 text-xs text-[#B8ADA0]">
                EGC Entrepreneurship &amp; Hackathon 2026 Distinctions
              </p>
            </div>
          </section>

          {/* Experience Section */}
          <section
            id="experience"
            className="py-16 lg:py-24 border-b border-[#F7EFE2]/10 grid grid-cols-1 lg:grid-cols-12 gap-10"
          >
            <div className="lg:col-span-4">
              <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#F7EFE2]">
                Selected{' '}
                <span className="italic text-[#E8A849]">Experience</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#B8ADA0] max-w-[34ch]">
                From institutional digital communication and national trade fairs to
                international teamwork in Cyprus and VIP stadium hospitality.
              </p>
            </div>

            <div className="lg:col-span-8 divide-y divide-[#F7EFE2]/10">
              {OCEANE_PROFILE.experience.map((item, idx) => (
                <article
                  key={`${item.organization}-${item.period}`}
                  className="py-7 first:pt-0 last:pb-0 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`font-serif italic text-xl tabular-nums ${
                          CHAPTER_ACCENTS[idx % CHAPTER_ACCENTS.length]
                        }`}
                      >
                        0{idx + 1}.
                      </span>
                      <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#F7EFE2]">
                        {item.organization}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-[#B8ADA0] tabular-nums">
                      {item.period}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm font-medium text-[#E8A849]">
                    {item.role}{' '}
                    <span className="text-[#B8ADA0] font-normal">
                      · {item.location}
                    </span>
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-[#B8ADA0]">
                    {item.summary}
                  </p>

                  <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-[#F7EFE2]/85">
                    {item.highlights.map((hl) => (
                      <li key={hl} className="leading-relaxed">
                        — {hl}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* Education, Honors, Skills & Interests */}
          <section
            id="education"
            className="py-16 lg:py-24 border-b border-[#F7EFE2]/10 grid grid-cols-1 lg:grid-cols-12 gap-12"
          >
            <div className="lg:col-span-6 space-y-10">
              <div>
                <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#F7EFE2]">
                  Academic{' '}
                  <span className="italic text-[#D94B64]">Path</span>
                </h2>
                <div className="mt-6 divide-y divide-[#F7EFE2]/10">
                  {OCEANE_PROFILE.education.map((edu) => (
                    <div key={edu.degree} className="py-5 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#F7EFE2]">
                          {edu.degree}
                        </h3>
                        <span className="font-mono text-xs text-[#B8ADA0] tabular-nums shrink-0">
                          {edu.period}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-[#E8A849]">
                        {edu.institution}
                      </p>
                      <p className="mt-2 text-sm text-[#B8ADA0] leading-relaxed">
                        {edu.focus}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-[#F7EFE2]/10">
                <h3 className="font-serif text-2xl font-normal text-[#F7EFE2]">
                  Distinctions &amp; Projects
                </h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {OCEANE_PROFILE.achievements.map((ach, i) => (
                    <div
                      key={ach.title}
                      className="p-4 rounded-xl bg-[#15131C]/80 border border-[#F7EFE2]/10"
                    >
                      <p
                        className={`text-sm font-semibold ${
                          i === 0 ? 'text-[#E8A849]' : 'text-[#D94B64]'
                        }`}
                      >
                        {ach.title}
                      </p>
                      <p className="mt-1 text-xs text-[#B8ADA0] leading-relaxed">
                        {ach.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-10">
              <div>
                <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#F7EFE2]">
                  Craft &amp;{' '}
                  <span className="italic text-[#7AA2FF]">Curiosity</span>
                </h2>
                <div className="mt-6 divide-y divide-[#F7EFE2]/10">
                  {OCEANE_PROFILE.interests.map((interest) => (
                    <div key={interest.title} className="py-5 first:pt-0 last:pb-0">
                      <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#F7EFE2]">
                        {interest.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-[#B8ADA0] leading-relaxed">
                        {interest.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-[#F7EFE2]/10 grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#F7EFE2]">
                    Océane’s Languages
                  </h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-[#B8ADA0]">
                    {OCEANE_PROFILE.languages.map((lang) => (
                      <li
                        key={lang.name}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <span className="text-[#F7EFE2]">{lang.name}</span>
                        <span className="text-xs text-[#E8A849] tabular-nums">
                          {lang.level}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-medium text-[#F7EFE2]">
                    Creative &amp; Digital Suite
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#B8ADA0]">
                    {OCEANE_PROFILE.tools.join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Contact & Footer */}
          <footer
            id="contact"
            className="py-14 flex flex-col md:flex-row md:items-end justify-between gap-8"
          >
            <div>
              <p className="text-xs text-[#E8A849]">{OCEANE_PROFILE.location}</p>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#F7EFE2]">
                Let’s create memorable{' '}
                <span className="italic bg-gradient-to-r from-[#E8A849] to-[#D94B64] bg-clip-text text-transparent">
                  brand experiences
                </span>
                .
              </h2>
              <div className="mt-5 flex flex-wrap items-center gap-6 text-sm text-[#F7EFE2]">
                <a
                  href={`mailto:${OCEANE_PROFILE.email}`}
                  className="inline-flex items-center gap-2 hover:text-[#E8A849] transition-colors whitespace-nowrap"
                >
                  <Mail className="w-4 h-4 text-[#E8A849]" />
                  <span>{OCEANE_PROFILE.email}</span>
                </a>
                <a
                  href="tel:+33761590956"
                  className="inline-flex items-center gap-2 hover:text-[#E8A849] transition-colors whitespace-nowrap tabular-nums"
                >
                  <Phone className="w-4 h-4 text-[#D94B64]" />
                  <span>{OCEANE_PROFILE.phone}</span>
                </a>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-[#B8ADA0]">
              <button
                type="button"
                onClick={() => setCvOpen(true)}
                className="underline underline-offset-4 hover:text-[#F7EFE2] transition-colors cursor-pointer whitespace-nowrap"
              >
                View CV PDF
              </button>
              <span>·</span>
              <span className="whitespace-nowrap">© 2026 Océane Dos Reis</span>
            </div>
          </footer>
        </main>

        <CvModal open={cvOpen} onClose={() => setCvOpen(false)} />
      </div>
    </MotionConfig>
  );
}
