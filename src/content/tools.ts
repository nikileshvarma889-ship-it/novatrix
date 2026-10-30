export type DemoKind = "chat" | "search" | "slides" | "images" | "voice" | "music" | "design";

export type Tool = {
  id: string;
  number: number;
  name: string;
  url: string;
  category: string;
  tagline: string;
  features: string[];
  accent: string;
  accent2: string;
  demo: DemoKind;
  prompt: string;
};

export const TOOLS: Tool[] = [
  {
    id: "claude",
    number: 1,
    name: "Claude",
    url: "claude.ai",
    category: "AI Assistant",
    tagline: "Your personal AI assistant",
    features: ["Write professional content", "Explain complex topics", "Analyse documents", "Help you write code"],
    accent: "#ff8a4c",
    accent2: "#ffc58f",
    demo: "chat",
    prompt: "Explain black holes like I'm 12, then quiz me",
  },
  {
    id: "perplexity",
    number: 2,
    name: "Perplexity",
    url: "perplexity.ai",
    category: "AI Research",
    tagline: "Answers with sources",
    features: ["AI-powered search", "Answers with citations", "Research in one place"],
    accent: "#20c4c4",
    accent2: "#8ff5e6",
    demo: "search",
    prompt: "What are the best ways to learn coding in 2026?",
  },
  {
    id: "gamma",
    number: 3,
    name: "Gamma",
    url: "gamma.app",
    category: "AI Presentations",
    tagline: "Idea → beautiful deck",
    features: ["Prompt to presentation", "Auto-designed slides", "Edit in seconds"],
    accent: "#a66bff",
    accent2: "#f0a6ff",
    demo: "slides",
    prompt: "A 6-slide pitch for an eco-friendly coffee brand",
  },
  {
    id: "leonardo",
    number: 4,
    name: "Leonardo AI",
    url: "leonardo.ai",
    category: "AI Image Generation",
    tagline: "Text → stunning images",
    features: ["Text-to-image", "Photoreal to fantasy", "Dozens of visual styles"],
    accent: "#f5b84c",
    accent2: "#ff7a59",
    demo: "images",
    prompt: "A floating city above the clouds at sunset, cinematic",
  },
  {
    id: "elevenlabs",
    number: 5,
    name: "ElevenLabs",
    url: "elevenlabs.io",
    category: "AI Voice",
    tagline: "Realistic AI voices",
    features: ["Text-to-speech", "Lifelike AI voices", "Narration & storytelling"],
    accent: "#e5e7eb",
    accent2: "#7dd3fc",
    demo: "voice",
    prompt: "Welcome back to the channel. Today, we explore the future.",
  },
  {
    id: "suno",
    number: 6,
    name: "Suno",
    url: "suno.com",
    category: "AI Music",
    tagline: "Describe it. Hear it.",
    features: ["Text-to-song", "Any genre or mood", "No instruments needed"],
    accent: "#ff4f9a",
    accent2: "#ffb86b",
    demo: "music",
    prompt: "Upbeat synthwave song about coding at midnight",
  },
  {
    id: "canva",
    number: 7,
    name: "Canva",
    url: "canva.com",
    category: "AI Design",
    tagline: "Design anything, faster",
    features: ["YouTube thumbnails", "Posters & presentations", "AI-powered editing"],
    accent: "#00c4cc",
    accent2: "#7d2ae8",
    demo: "design",
    prompt: "YouTube thumbnail: 7 FREE AI tools, bold & neon",
  },
];
