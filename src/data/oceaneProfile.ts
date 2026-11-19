export type MariaLanguageCode = 'auto' | 'en' | 'fr' | 'pt' | 'ar' | 'es';

export interface MariaLanguageOption {
  code: MariaLanguageCode;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
  samplePrompts: string[];
  greetingInstruction: string;
}

export const MARIA_LANGUAGES: MariaLanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    dir: 'ltr',
    samplePrompts: [
      "Introduce Océane's brand & event experience",
      'Tell me about her internship in Cyprus',
      'What Master program is she joining in 2026?',
    ],
    greetingInstruction:
      'Greet the visitor warmly and professionally in English as Maria, Océane Dos Reis’s voice assistant, and invite them to ask about Océane’s experience, education, or skills.',
  },
  {
    code: 'fr',
    label: 'French',
    nativeLabel: 'Français',
    dir: 'ltr',
    samplePrompts: [
      'Présente le parcours d’Océane en communication',
      'Parle-moi de son alternance à l’Anses',
      'Quelles sont ses compétences créatives et linguistiques ?',
    ],
    greetingInstruction:
      'Salue le visiteur avec élégance et professionnalisme en français en tant que Maria, l’assistante vocale d’Océane Dos Reis, et propose-lui de découvrir son parcours.',
  },
  {
    code: 'pt',
    label: 'Portuguese',
    nativeLabel: 'Português',
    dir: 'ltr',
    samplePrompts: [
      'Apresenta a experiência da Océane em eventos',
      'Fala sobre o estágio dela no Chipre',
      'Quais prémios académicos ela conquistou?',
    ],
    greetingInstruction:
      'Cumprimenta o visitante de forma calorosa e profissional em português como Maria, assistente de voz de Océane Dos Reis, convidando-o a conhecer o percurso dela.',
  },
  {
    code: 'ar',
    label: 'Arabic',
    nativeLabel: 'العربية',
    dir: 'rtl',
    samplePrompts: [
      'قدّمي لي نبذة عن مسيرة أوسيان المهنية',
      'حدّثيني عن تجربتها في تنظيم الفعاليات',
      'ما هي اللغات والمهارات التي تتقنها أوسيان؟',
    ],
    greetingInstruction:
      'رحّبي بالزائر بلباقة واحترافية باللغة العربية بصفتكِ ماريا، المساعدة الصوتية لأوسيان دوس ريس، وادعيه للاستفسار عن خبرتها وتعليمها.',
  },
  {
    code: 'es',
    label: 'Spanish',
    nativeLabel: 'Español',
    dir: 'ltr',
    samplePrompts: [
      'Preséntame el perfil profesional de Océane',
      'Cuéntame sobre su experiencia en Parc des Princes',
      '¿Qué herramientas creativas domina?',
    ],
    greetingInstruction:
      'Saluda al visitante con calidez y profesionalismo en español como Maria, la asistente de voz de Océane Dos Reis, e invítalo a preguntar sobre su trayectoria.',
  },
];

export interface ExperienceItem {
  period: string;
  role: string;
  organization: string;
  location: string;
  summary: string;
  highlights: string[];
}

export interface EducationItem {
  period: string;
  degree: string;
  institution: string;
  focus: string;
}

export interface AchievementItem {
  title: string;
  detail: string;
}

export const OCEANE_PROFILE = {
  fullName: 'Océane Dos Reis',
  headline: 'Brand Experience, Event & Digital Communication',
  location: 'Champs-sur-Marne, France',
  email: 'oce.dosreis@gmail.com',
  phone: '07 61 59 09 56',
  cvPath: '/assets/aistudio/CV_3_5c301829.pdf',
  intro:
    'Future Master Brand Experience & Event student at Sup de Pub (October 2026, 100% in English). Combining strategic management training at EGC with hands-on digital communication, international event production, and luxury hospitality.',
  education: [
    {
      period: 'Oct 2026 — Future',
      degree: 'Master Brand Experience & Event',
      institution: 'Sup de Pub',
      focus: 'Program delivered entirely in English, deepening expertise in brand activations and experiential events.',
    },
    {
      period: '2023 — 2026',
      degree: 'Bachelor EGC 3',
      institution: 'École de Gestion et de Commerce',
      focus: 'Specialization in Management & Commerce · Marketing, Strategy, Finance & Business Management.',
    },
    {
      period: '2023',
      degree: 'Baccalauréat',
      institution: 'Lycée Françoise Cabrini',
      focus: 'Life & Earth Sciences (SVT) and Physics-Chemistry.',
    },
  ] as EducationItem[],
  experience: [
    {
      period: 'Sep 2024 — Present',
      role: 'Digital Communication Apprentice',
      organization: 'Anses',
      location: 'Maisons-Alfort · Alternance',
      summary:
        'Driving visual identity, institutional events, and social media presence across internal and external channels.',
      highlights: [
        'Graphic creation and visual editorial assets',
        'Social media monitoring and community insight',
        'Organization & on-site execution for major events including Salon de l’Agriculture',
        'Internal and external corporate communication',
      ],
    },
    {
      period: 'Oct 2024 — Apr 2025',
      role: 'VIP Hospitality Hostess & Waitress',
      organization: 'Potel & Chabot',
      location: 'Parc des Princes, Paris',
      summary:
        'Delivering high-standard French luxury hospitality inside executive stadium suites during live matchdays.',
      highlights: [
        'VIP guest reception in private hospitality suites (loges) at Parc des Princes',
        'Precision table service in a high-tempo live event environment',
      ],
    },
    {
      period: 'Apr 2024 — Jul 2024',
      role: 'Digital & Event Communication Intern',
      organization: 'Dorea Institut',
      location: 'Cyprus · International Internship',
      summary:
        'Collaborated daily in English within a multicultural team on European digital and event initiatives.',
      highlights: [
        'Digital communication and international event coordination',
        'Creation of multilingual visual communication supports',
        'Daily collaboration in English within an intercultural team',
      ],
    },
    {
      period: 'Dec 2023',
      role: 'Sales & Management Intern',
      organization: 'Lancel',
      location: 'France · Luxury Leather Goods',
      summary:
        'Supported boutique retail operations, client relationship records, and visual stock curation.',
      highlights: [
        'Client advisory and luxury boutique sales',
        'Client database management (CRM) and stock organization',
      ],
    },
  ] as ExperienceItem[],
  achievements: [
    {
      title: 'Hackathon 2026',
      detail: '2nd Place across EGC network schools',
    },
    {
      title: 'EGC Entrepreneurship Project',
      detail: '1st Place · Strategic market study & venture pitch',
    },
  ] as AchievementItem[],
  languages: [
    { name: 'French', level: 'Native' },
    { name: 'English', level: 'B2 · TOEIC 900/990' },
    { name: 'Spanish', level: 'B1' },
    { name: 'Portuguese', level: 'B1' },
  ],
  tools: ['Photoshop', 'Canva', 'PlayPlay', 'CapCut', 'Excel', 'Pix'],
  interests: [
    {
      title: 'Creation',
      body: 'Creative from an early age—imagining, crafting, and turning ideas into tangible visual and experiential projects.',
    },
    {
      title: 'Discovery',
      body: 'Driven by curiosity—documentaries and international travel constantly nourish a desire to learn and explore.',
    },
    {
      title: 'Languages',
      body: 'Committed to daily linguistic growth across spoken languages, with an aspiration to learn Sign Language.',
    },
  ],
};
