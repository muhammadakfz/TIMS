import type { NextApiRequest, NextApiResponse } from 'next';
let google: any;
let streamText: any;
try {
  // Optional SDK imports — if the project has these packages installed this will wire up.
  // Otherwise we fall back to an instructive runtime error.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  google = require('@ai-sdk/google').google;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  streamText = require('ai').streamText;
} catch (err) {
  google = null;
  streamText = null;
}

import { getModel } from '../../lib/geminiModel';

// Local prompt/tools are optional — if not present, the endpoint will still guide the developer.
let SYSTEM_PROMPT: any = null;
let getContact: any = null;
let getInternship: any = null;
let getPresentation: any = null;
let getProjects: any = null;
let getResume: any = null;
let getSkills: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SYSTEM_PROMPT = require('../../components/prompt').SYSTEM_PROMPT;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getContact = require('../../components/tools/getContact').getContact;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getInternship = require('../../components/tools/getIntership').getInternship;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getPresentation = require('../../components/tools/getPresentation').getPresentation;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getProjects = require('../../components/tools/getProjects').getProjects;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getResume = require('../../components/tools/getResume').getResume;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getSkills = require('../../components/tools/getSkills').getSkills;
} catch (err) {
  // missing local modules are okay — we'll notify when the endpoint is hit.
}

function errorHandler(error: unknown) {
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

function extractGeminiText(resp: any): string {
  const candidate = resp?.candidates?.[0];
  if (!candidate) return '';
  const parts = candidate.content?.parts || [];
  const texts = parts.map((p: any) => p.text).filter(Boolean);
  return texts.join('\n');
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Prepend system prompt if not present
    messages.unshift(SYSTEM_PROMPT);

    const tools = {
      getProjects,
      getPresentation,
      getResume,
      getContact,
      getSkills,
      getInternship,
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const envModel = process.env.GEMINI_MODEL;
    const modelToUse = envModel ? envModel : await getModel(apiKey);

    const rawResponse = await streamText({
      model: google(modelToUse),
      messages,
      toolCallStreaming: true,
      tools,
      maxSteps: 2,
    });

    const text = extractGeminiText(rawResponse);

    if (!text) {
      console.error('No text found, raw response:', JSON.stringify(rawResponse, null, 2));
      return new Response('Gemini model returned no text', { status: 500 });
    }

    return new Response(text, { status: 200 });
  } catch (err) {
    console.error('Global error:', err);
    const errorMessage = errorHandler(err);
    return new Response(errorMessage, { status: 500 });
  }
}
