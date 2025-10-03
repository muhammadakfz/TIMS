let cachedModel: string | null = null;
let cacheExpiry = 0;

async function listAvailableModels(apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ListModels failed: ${res.status} ${txt}`);
  }
  return res.json();
}

function pickCandidateModel(models: any[]): string | null {
  const names = models
    .map((m) => m.name || m.model || '')
    .filter(Boolean);

  // Prefer explicit 2.5 flash, then any flash, then any gemini-
  const prefer = names.find((n) => /gemini-2\.5.*flash/i.test(n));
  if (prefer) return prefer;
  const flash = names.find((n) => /gemini.*flash/i.test(n));
  if (flash) return flash;
  const anyGemini = names.find((n) => /gemini-/i.test(n));
  return anyGemini || null;
}

export async function getModel(apiKey: string) {
  const now = Date.now();
  if (cachedModel && now < cacheExpiry) return cachedModel;

  const json = await listAvailableModels(apiKey);
  const models = Array.isArray(json?.models) ? json.models : [];
  const chosen = pickCandidateModel(models);

  if (!chosen) throw new Error(`No usable Gemini model found. ListModels returned ${JSON.stringify(json)}`);

  cachedModel = chosen;
  cacheExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
  return cachedModel;
}

export function normalizeModelName(model?: string) {
  if (!model) return model;
  return model.startsWith('models/') ? model : model;
}
