import { GoogleGenAI } from "@google/genai";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export interface GeminiKeyMetaData {
  id: string;
  key: string;
  isCustom?: boolean;
}

let cachedKeys: GeminiKeyMetaData[] = [];
const sessionExhaustedKeys: Set<string> = new Set();
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function getGeminiKeys(): Promise<GeminiKeyMetaData[]> {
  const now = Date.now();
  if (cachedKeys.length > 0 && now - lastFetch < CACHE_TTL) {
    return cachedKeys;
  }

  const keys: GeminiKeyMetaData[] = [];
  
  // Add environment key if available
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process as unknown as { env: Record<string, string> }).env?.GEMINI_API_KEY : undefined);
  if (envKey) {
    keys.push({ id: 'env-primary', key: envKey, isCustom: true });
  }

  try {
    const keysColl = collection(db, "geminiKeys");
    const snapshot = await getDocs(keysColl);
    const firestoreKeys = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as GeminiKeyMetaData))
      .filter(k => k.key);
    
    keys.push(...firestoreKeys);
  } catch (error) {
    console.warn("Firestore Gemini keys fetch failed, using environment key only if available.", error);
  }

  cachedKeys = keys;
  lastFetch = now;
  return keys;
}

async function markKeyInvalid(keyMeta: GeminiKeyMetaData) {
  if (keyMeta.isCustom) return;
  try {
    await updateDoc(doc(db, "geminiKeys", keyMeta.id), { isActive: false, invalidReason: 'API_KEY_INVALID' });
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
  externalLinks?: string;
  autoExternalLinks?: boolean;
  length?: 'short' | 'medium' | 'long' | string;
  outline?: unknown;
  brandVoice?: unknown;
  template?: string;
}

async function executeWithRotation<T>(fn: (ai: GoogleGenAI) => Promise<T>, context: string): Promise<T> {
  const maxRetries = 5; // Increased retries
  const allKeys = await getGeminiKeys();
  
  for (let i = 0; i < maxRetries; i++) {
    const availableKeys = allKeys.filter(k => !sessionExhaustedKeys.has(k.id));
    if (availableKeys.length === 0) {
      throw new Error("SYSTEM_EXHAUSTED: All available Gemini API keys have reached their rate limits.");
    }

    // Try a random available key to distribute load
    const nextMeta = availableKeys[Math.floor(Math.random() * availableKeys.length)];

    try {
      const ai = new GoogleGenAI({ apiKey: nextMeta.key });
      return await fn(ai);
    } catch (error) {
      const err = error as { status?: number; code?: number; message?: string };
      console.error(`Gemini Error [${context}] with key ${nextMeta.id}:`, err?.message || err);

      const status = err?.status || err?.code || 0;
      const message = (err?.message || "").toUpperCase();

      if (status === 403 || message.includes('API_KEY_INVALID')) {
        if (!nextMeta.isCustom) await markKeyInvalid(nextMeta);
      }
      
      const isQuota = status === 429 || message.includes('RESOURCE_EXHAUSTED') || message.includes('QUOTA');
      if (isQuota) {
        sessionExhaustedKeys.add(nextMeta.id);
      }

      // If it's a structural error (400), don't bother retrying with other keys
      if (status === 400) {
        throw new Error(`AI_STRUCTURAL_ERROR: ${err.message}`, { cause: error });
      }

      // Wait a bit before next rotation
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${context} failed after multiple attempts. Please check your network or try again later.`);
}

function sanitizeJSON(text: string): string {
  // Remove markdown code blocks if present
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export const geminiKeyService = {
  execute: executeWithRotation
};

// --- Specialized AI Features ---

export async function generateIdeas(topic: string, audience: string = 'General', goal: string = 'Traffic') {
  const prompt = `Generate 5 creative blog post ideas for: "${topic}". 
  Audience: ${audience}, Goal: ${goal}.
  Return as a JSON array of objects with { Title, BriefExplanation, Tag, SearchIntent, TargetKeyword }.`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || '';
    return JSON.parse(sanitizeJSON(text));
  }, "Idea Generation");
}

export async function generateOutline(request: ContentRequest) {
  const prompt = `Create a logical outline for: "${request.topic}". 
  Audience: ${request.audience}, Length: ${request.length}, Template: ${request.template || 'None'}.
  ${request.externalLinks ? `References/Links to include: ${request.externalLinks}` : ''}
  Return strictly JSON { Title, Headings: [{title, description}] }.`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || '';
    return JSON.parse(sanitizeJSON(text));
  }, "Outline Generation");
}

export async function generateFullContent(request: ContentRequest) {
  const prompt = `Write a comprehensive, professional, and HIGHLY UNIQUE blog post about: ${request.topic}.
  TONE: ${request.tone}
  AUDIENCE: ${request.audience}
  KEYWORDS: ${request.keywords?.join(', ')}
  
  QUALITY CONSTRAINTS:
  - DO NOT use generic AI filler or clichés (e.g., "In the fast-paced world of...", "Crucial role").
  - Provide specific examples, data-driven insights (even if general), and unique angles not found in standard search results.
  - Ensure the content passes "human-writer" sniff tests for creativity and flow.
  - ${request.externalLinks ? `MANDATORY: You must naturally weave in and HYPERLINK THESE SPECIFIC REFERENCES using Markdown [Site Name](URL): ${request.externalLinks}. Do NOT just list them, link them in the text.` : ''}
  ${request.autoExternalLinks ? `CRITICAL: Actively research and link to authoritative external sources (Citations) throughout the article using Markdown [Title](URL). Every major claim should have a link.` : 'Include external resources.'}
  
  OUTLINE: ${JSON.stringify(request.outline)}
  
  FORMATTING:
  - Compelling H1 Title
  - Structured H2/H3 sections
  - Engaging intro and transformative conclusion
  - Use Bullet points, bold keywords, and professional spacing.
  - USE MARKDOWN.`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || '';
  }, "Content Writing");
}

export async function optimizeSEO(content: string, keywords: string[]) {
  const prompt = `Analyze this article for SEO. Keywords: ${keywords.join(', ')}.
    Return JSON { seoScore, metaTitle, metaDescription, urlSlug, suggestedChanges: [{field, suggestion, advice}], readabilityGrade, keywordDensity: {} }.
    Article: ${content.substring(0, 3000)}`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || '';
    return JSON.parse(sanitizeJSON(text));
  }, "SEO Optimization");
}

export async function generateImagePrompts(contentOrTopic: string, description?: string) {
  const content = description ? `${contentOrTopic}: ${description}` : contentOrTopic;
  const prompt = `Based on the following article content, generate 5 distinct, SHORT, and highly descriptive image prompts (max 15 words each). 
  Focus on identifying the visual essence for different sections. Use keywords like cinematic, photorealistic, 8k, professional lighting.
  Return strictly JSON { "prompts": ["prompt1", "prompt2", ...] }.
  
  Content: ${content.substring(0, 1500)}`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const text = response.text || '';
    const parsed = JSON.parse(sanitizeJSON(text));
    return parsed.prompts || [];
  }, "Image Prompt Generation");
}

export async function repurposeContent(content: string, targetPlatform: string, brandVoice?: unknown) {
  const prompt = `Repurpose for ${targetPlatform}: ${content.substring(0, 4000)}.
  Voice: ${JSON.stringify(brandVoice)}`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || '';
  }, "Repurposing");
}

export async function summarizeContent(content: string) {
  const prompt = `Summarize the following content into 3-5 concise, high-impact key takeaways. 
  Focus on the most valuable insights for the reader. 
  Return as a clean Markdown bulleted list.
  Content: ${content.substring(0, 5000)}`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || '';
  }, "Summarization");
}

export type ToolId = 
  | 'HeadlineAnalyzer' | 'FAQGenerator' | 'NewsletterGen' | 'ProductDesc' 
  | 'MetaTags' | 'IntroGen' | 'Outlining' | 'Summarizer'
  | 'GrammarFix' | 'ContentGap' | 'AuthorityMap' | 'QuoraAnswer' 
  | 'VideoScript' | 'CaseStudy' | 'WhitepaperBody' | 'ExplainerGen';

export async function runSpecializedTool(type: ToolId, input: string) {
  const prompt = `Execute tool ${type} on input: ${input}`;

  return executeWithRotation(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || '';
  }, "Tool Execution");
}
