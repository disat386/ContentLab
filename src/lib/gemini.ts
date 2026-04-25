import { GoogleGenAI } from "@google/genai";
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

interface GeminiKeyMetaData {
  id: string;
  key: string;
  status?: string;
  isWorking?: boolean;
}

let cachedKeys: GeminiKeyMetaData[] = [];
const sessionExhaustedKeys: Set<string> = new Set();
let currentKeyIndex = 0;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function getGeminiKeys(): Promise<GeminiKeyMetaData[]> {
  const now = Date.now();
  if (cachedKeys.length > 0 && (now - lastFetch) < CACHE_TTL) {
    return cachedKeys;
  }

  const collectionsToTry = ['gemini_keys', 'api_keys', 'keys'];
  let allFetchedKeys: (GeminiKeyMetaData & { collection?: string })[] = [];

  try {
    for (const collName of collectionsToTry) {
      try {
        const q = query(
          collection(db, collName), 
          where('isWorking', '!=', false)
        );
        const snap = await getDocs(q);
        
        const keys = snap.docs.map(d => ({
          id: d.id,
          collection: collName,
          ...d.data()
        })) as (GeminiKeyMetaData & { collection: string })[];
        
        allFetchedKeys = [...allFetchedKeys, ...keys];
      } catch {
        // Silently skip if collection doesn't exist or is inaccessible
      }
    }
    
    // Mix in the system key if available
    if (process.env.GEMINI_API_KEY) {
      if (!allFetchedKeys.find(k => k.key === process.env.GEMINI_API_KEY)) {
        allFetchedKeys.push({ id: 'system-env', key: process.env.GEMINI_API_KEY!, isWorking: true });
      }
    }

    cachedKeys = allFetchedKeys;
    lastFetch = now;
    return cachedKeys;
  } catch (error) {
    console.error("Error fetching Gemini keys from Firestore:", error);
    return process.env.GEMINI_API_KEY ? [{ id: 'system-env', key: process.env.GEMINI_API_KEY, isWorking: true }] : [];
  }
}

async function getAIInstance(): Promise<{ ai: GoogleGenAI; meta: GeminiKeyMetaData }> {
  const allKeys = await getGeminiKeys();
  
  // Filter out keys already known to be exhausted in this session
  const availableKeys = allKeys.filter(k => !sessionExhaustedKeys.has(k.id));

  if (availableKeys.length === 0) {
    throw new Error("SYSTEM_EXHAUSTED: All available Gemini API keys in the Hub pool have reached their rate limits. Please try again in 1-2 minutes or use your own API key.");
  }

  // Pick the next one (wrapped by modulo)
  const nextMeta = availableKeys[currentKeyIndex % availableKeys.length];
  currentKeyIndex = (currentKeyIndex + 1) % availableKeys.length;

  return {
    ai: new GoogleGenAI({ apiKey: nextMeta.key }),
    meta: nextMeta
  };
}

async function markKeyAsInvalid(keyMeta: GeminiKeyMetaData & { collection?: string }) {
  if (keyMeta.id === 'system-env') return;
  try {
    const collName = keyMeta.collection || 'gemini_keys';
    const keyRef = doc(db, collName, keyMeta.id);
    await updateDoc(keyRef, { isWorking: false, status: 'invalid' });
    console.warn(`Marked key ${keyMeta.id} from ${collName} as invalid in Firestore.`);
    // Refresh cache
    lastFetch = 0;
  } catch (e) {
    console.error("Failed to mark key as invalid:", e);
  }
}

export interface ContentRequest {
  topic: string;
  audience: string;
  tone: string;
  goal?: string;
  keywords?: string[];
  length?: 'short' | 'medium' | 'long' | string;
  outline?: unknown;
  brandVoice?: unknown;
}

// Centralized Error Handler
function handleGeminiError(error: unknown, context: string) {
  console.error(`${context} Error:`, error);
  
  const err = error as { status?: number; message?: string };
  
  if (err?.message?.includes('SYSTEM_EXHAUSTED')) {
    throw new Error(err.message);
  }

  // Handle Quota/Rate Limit Errors
  if (err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED')) {
    throw new Error("AI Quota Exceeded: Your plan's rate limit has been reached. Please wait 60 seconds or check your Gemini API billing settings in Google AI Studio.");
  }
  
  // Handle other known issues
  if (err?.message?.includes('API_KEY_INVALID')) {
    throw new Error("Invalid API Key: Please check your Gemini API key in the app settings.");
  }

  throw error;
}

// Wrapper for rotation logic (formerly withRetry)
async function executeWithRotation<T>(fn: (ai: GoogleGenAI) => Promise<T>, context: string): Promise<T> {
  let lastError: unknown;
  const allKeys = await getGeminiKeys();
  const maxRetries = Math.max(allKeys.length, 2);

  for (let i = 0; i < maxRetries; i++) {
    let currentMeta: GeminiKeyMetaData | null = null;
    try {
      const { ai, meta } = await getAIInstance();
      currentMeta = meta;
      return await fn(ai);
    } catch (error) {
      lastError = error;
      const err = error as { status?: number; message?: string };
      
      // If it's a System Exhausted error, just stop
      if (err?.message?.includes('SYSTEM_EXHAUSTED')) {
        break;
      }

      // Handle Invalid Key (403 or specific message)
      if (err?.status === 403 || err?.message?.includes('API_KEY_INVALID')) {
        if (currentMeta) {
          await markKeyAsInvalid(currentMeta);
        }
      }

      const isQuota = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuota && currentMeta) {
        // Mark as exhausted in session
        sessionExhaustedKeys.add(currentMeta.id);
        console.warn(`${context}: Key ${currentMeta.id} reached quota. Added to session exclusion. Pool size remaining: ${allKeys.length - sessionExhaustedKeys.size}`);
      }

      if (!isQuota && !(err?.status === 403)) break; // Only retry on quota or invalid key errors
      
      console.warn(`${context}: Error on key rotation attempt ${i + 1}/${maxRetries}. Retrying with next available...`);
      // Short delay before retry
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  handleGeminiError(lastError, context);
  throw lastError; // unreachable
}

// Export the service as requested
export const geminiKeyService = {
  getKeys: getGeminiKeys,
  execute: executeWithRotation,
  markInvalid: markKeyAsInvalid
};

// 1. Idea Generator
export async function generateIdeas(niche: string, audience: string, goal: string) {
  const prompt = `
    You are ContentLab AI Idea Generator.
    Niche: ${niche}
    Target Audience: ${audience}
    Goal: ${goal}

    Suggest 10 high-quality blog ideas.
    For each idea, provide:
    - Title
    - Brief Explanation (1 sentence)
    - Target Keyword
    - Search Intent (Informational, Navigational, Transactional, Commercial)
    - Content Score (1-100)
    - Tag: (Evergreen, Trending, Viral, SEO)

    Format as a JSON array of objects.
  `;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  }, "Idea Generation");
}

// 2. Smart Outline Generator
export async function generateOutline(request: ContentRequest) {
  const prompt = `
    Create a detailed SEO-friendly blog outline for: "${request.topic}".
    Audience: ${request.audience}
    Target Keywords: ${request.keywords?.join(', ')}
    Length: ${request.length}

    Include:
    - Optimized Title (H1)
    - Intro points
    - Headings (H2, H3) with short descriptions
    - FAQ titles
    - Suggested CTAs
    - Conclusion plan

    Format as a JSON object.
  `;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  }, "Outline Generation");
}

// 3. Full Content Writer
export async function generateFullContent(request: ContentRequest) {
  const prompt = `
    Write a complete article based on this ${request.outline ? 'outline' : 'topic'}: "${request.topic}".
    Outline: ${request.outline ? JSON.stringify(request.outline) : 'None'}
    Audience: ${request.audience}
    Tone: ${request.tone}
    Keywords: ${request.keywords?.join(', ')}
    Length: ${request.length}
    Brand Voice: ${request.brandVoice ? JSON.stringify(request.brandVoice) : 'Default'}

    Ensure the content is engaging, authoritative, and follows SEO best practices.
    Include Markdown formatting, subheadings, lists, and a strong conclusion.
  `;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  }, "Content Writing");
}

// 4. SEO Optimizer & Metadata
export async function optimizeSEO(content: string, keywords: string[]) {
  const prompt = `
    Analyze this article and provide SEO optimization data:
    Article: ${content.substring(0, 5000)}
    Target Keywords: ${keywords.join(', ')}

    Return a JSON object with:
    - seoScore (0-100)
    - metaTitle
    - metaDescription (max 160 chars)
    - urlSlug
    - suggestedChanges (array of strings)
    - readabilityGrade
    - keywordDensity (object)
  `;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  }, "SEO Optimization");
}

// 5. Repurposer
export async function repurposeContent(content: string, targetPlatform: string, brandVoice?: unknown) {
  const prompt = `
    Repurpose the following content for ${targetPlatform}.
    Brand Voice: ${brandVoice ? JSON.stringify(brandVoice) : 'Default Professional'}
    Content: ${content.substring(0, 5000)}

    Goal: Convert into a high-engagement, platform-specific post.
    LinkedIn: Professional, insight-driven, with hooks.
    Twitter/X: Thread format with hooks and hashtags.
    Social: Short, viral-style caption.
    Newsletter: Personal, value-driven summary.
  `;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  }, "Repurposing");
}

// 6. Advanced Specialized Tools
export type ToolId = 
  | 'HeadlineAnalyzer' | 'FAQGenerator' | 'NewsletterGen' | 'ProductDesc' 
  | 'MetaTags' | 'IntroGen' | 'Outlining' | 'Summarizer' 
  | 'GrammarFix' | 'ContentGap' | 'AuthorityMap' | 'QuoraAnswer' 
  | 'VideoScript' | 'CaseStudy' | 'WhitepaperBody';

export async function runSpecializedTool(type: ToolId, input: string, context?: { audience?: string; keywords?: string[] }) {
  const prompts: Record<ToolId, string> = {
    HeadlineAnalyzer: `Analyze the following headlines for click-through rate, sentiment, and power words. Provide 5 improved alternatives. Input: ${input}`,
    FAQGenerator: `Generate 10 frequently asked questions and short, authoritative answers based on this content: ${input}`,
    NewsletterGen: `Transform this article into a punchy, high-conversion email newsletter for a list. Include a subject line and CTA. Content: ${input}`,
    ProductDesc: `Write a compelling Benefit-First product description for: ${input}. Target Audience: ${context?.audience || 'General'}`,
    MetaTags: `Generate SEO Meta Title (max 60 chars) and Meta Description (max 160 chars) for this topic: ${input}. Keywords: ${context?.keywords || 'None'}`,
    IntroGen: `Write 3 different hook styles (The Question, The Statistic, The Story) for a blog post about: ${input}`,
    Outlining: `Create a comprehensive, logical content outline for a long-form article about: ${input}`,
    Summarizer: `Summarize this content into 3 bullet points of "Executive Significance": ${input}`,
    GrammarFix: `Proofread and improve the flow and authority of this text without changing the core message: ${input}`,
    ContentGap: `Analyze this topic: ${input}. Identify 5 missing sub-topics or unique angles not commonly covered by competitors.`,
    AuthorityMap: `Create a "Topic Cluster" map for: ${input}. List a Pillar post and 8 sub-topics for internal linking.`,
    QuoraAnswer: `Write a helpful, authoritative Quora-style answer that naturally mentions the expertise on: ${input}`,
    VideoScript: `Convert this content into a 2-minute YouTube/TikTok script. Include visual cues. Content: ${input}`,
    CaseStudy: `Structure a compelling Case Study (Problem, Solution, Results) template for: ${input}`,
    WhitepaperBody: `Generate a professional, data-driven section for an industry whitepaper regarding: ${input}`
  };

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompts[type],
    });
    return response.text;
  }, "Tool Execution");
}

// 7. Image Prompt Generator
export async function generateImagePrompts(topic: string, description: string) {
  const prompt = `
    Generate 3 distinct image generation prompts for a blog post about: "${topic}".
    Context: ${description}
    Format:
    1. Featured Header (Photorealistic/Modern/Minimalist)
    2. Infographic Style
    3. Conceptual/Abstract
    Return only the prompts.
  `;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  }, "Image Prompt");
}

// Legacy functions for compatibility (if needed)
export async function generateBlogPost(request: ContentRequest) {
  return generateFullContent({ ...request });
}

export async function curateTopics(interest: string) {
  return generateIdeas(interest, "General", "Education");
}

