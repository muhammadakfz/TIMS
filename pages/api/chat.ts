// Next.js API route for AI chat using Google Gemini

import type { NextApiRequest, NextApiResponse } from "next";

function buildLocalInsight(temp: number, finishReason?: string | null) {
  const rounded = Number.isFinite(temp) ? Number(temp.toFixed(1)) : temp;

  let comfortLabel = "nyaman";
  let condition = "normal";
  let advice = "Tidak perlu tindakan khusus, tetap pantau sensor.";

  if (temp < 18) {
    comfortLabel = "dingin";
    condition = "lebih rendah dari batas nyaman";
    advice = "Pertimbangkan menutup ventilasi atau menyalakan penghangat seperlunya.";
  } else if (temp >= 18 && temp <= 26) {
    comfortLabel = "nyaman";
    condition = "dalam rentang ideal";
    advice = "Pertahankan kondisi saat ini dan pastikan sirkulasi udara tetap baik.";
  } else if (temp > 26 && temp <= 30) {
    comfortLabel = "hangat";
    condition = "sedikit lebih tinggi dari ideal";
    advice = "Periksa ventilasi dan kurangi sumber panas di dalam ruangan.";
  } else if (temp > 30) {
    comfortLabel = "panas";
    condition = "melampaui batas aman";
    advice = "Aktifkan pendingin atau buka ventilasi untuk menurunkan suhu secepatnya.";
  }

  const finishSuffix = finishReason === "MAX_TOKENS"
    ? " (catatan: respons AI penuh tidak tersedia, menampilkan ringkasan lokal)"
    : "";

  return `Suhu ruangan saat ini sekitar ${rounded}°C, terasa ${comfortLabel} dan ${condition}. ${advice}${finishSuffix}`;
}

type Data = {
  response?: string;
  error?: string;
  fallback?: boolean;
  model?: string;
  usedAlternateModel?: boolean;
  availableModels?: string[];
};

type GeminiResult = {
  text: string;
  finishReason?: string;
  blockReason?: string;
  safetySummary?: string;
  json: any;
};

const FALLBACK_MODEL = "models/gemini-2.5-flash";

type RequestPayload = {
  temperature?: unknown;
  prompt?: unknown;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt, temperature } = req.body as RequestPayload;

  const apiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const rawModel = (process.env.GEMINI_MODEL || "").trim();
  const modelPattern = /^(?:models\/)?gemini-[\w.-]+$/i;
  const defaultModel = "models/gemini-2.5-flash";
  const normalizedModel = modelPattern.test(rawModel)
    ? rawModel.startsWith("models/")
      ? rawModel
      : `models/${rawModel}`
    : defaultModel;

  const parsedTemperature = (() => {
    if (typeof temperature === "number" && Number.isFinite(temperature)) {
      return temperature;
    }
    if (typeof temperature === "string") {
      const numeric = parseFloat(temperature);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
    return null;
  })();

  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";

  const insightPrompt = trimmedPrompt || (() => {
    if (parsedTemperature === null) return "";
    const displayTemp = parsedTemperature.toFixed(1);
    return [
      "Anda adalah TIMS AI, asisten yang memantau kondisi ruangan berbasis sensor suhu.",
      `Data terbaru menunjukkan suhu ruangan ${displayTemp}°C.`,
      "Tuliskan analisis ringkas dalam Bahasa Indonesia maksimal dua kalimat (<= 60 kata):",
      "- jelaskan kondisi kenyamanan ruangan dan kategori suhunya (normal, hangat, panas, atau dingin),",
      "- beri saran tindakan sederhana bila diperlukan,",
      "- jika suhu berada di bawah 18°C atau di atas 30°C, sertakan peringatan singkat.",
      "Jangan menyebut diri sebagai AI dan jangan menambahkan penutup yang tidak perlu.",
    ].join("\n");
  })();

  const finalPrompt = insightPrompt.trim();

  if (!finalPrompt) {
    return res.status(400).json({ error: "Temperature or prompt required." });
  }

  const systemInstruction = {
    role: "system",
    parts: [
      {
        text: [
          "Anda adalah TIMS AI yang membantu penghuni memahami kondisi ruangan berbasis suhu.",
          "Selalu jawab dalam Bahasa Indonesia baku, maksimal dua kalimat (<= 60 kata).",
          "Fokus pada kenyamanan, risiko singkat, dan tindakan praktis. Hindari pengantar atau penutup panjang.",
        ].join(" "),
      },
    ],
  } as const;

  const contents = [
    {
      role: "user",
      parts: [{ text: finalPrompt }],
    },
  ];

  try {
    const generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 200,
    };

    const invokeModel = async (model: string): Promise<GeminiResult> => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      const payload = {
        systemInstruction,
        contents,
        generationConfig,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMsg = "Unknown error";
        try {
          const errJson = await response.json();
          errMsg = errJson.error?.message || JSON.stringify(errJson);
        } catch {
          errMsg = await response.text();
        }
        throw new Error(`[${model}] ${errMsg}`);
      }

      const json = await response.json();
      const candidates = Array.isArray(json.candidates) ? json.candidates : [];
      const firstWithText = candidates.find((candidate: any) =>
        Array.isArray(candidate?.content?.parts) &&
        candidate.content.parts.some((part: any) => typeof part?.text === "string" && part.text.trim())
      );

      const textPart = firstWithText?.content?.parts?.find?.(
        (part: any) => typeof part?.text === "string" && part.text.trim()
      );

      const safetyRatings = json.promptFeedback?.safetyRatings || firstWithText?.safetyRatings;
      const safetySummary = Array.isArray(safetyRatings)
        ? safetyRatings
            .map((rating: any) => {
              const category = rating?.category || "unknown";
              const probability = rating?.probability || rating?.probabilityScore;
              return `${category}${probability ? ` (${probability})` : ""}`;
            })
            .join(", ")
        : undefined;

      return {
        text: textPart?.text?.trim() || "",
        finishReason: firstWithText?.finishReason,
        blockReason: json.promptFeedback?.blockReason,
        safetySummary,
        json,
      };
    };

    const modelsToTry = normalizedModel === FALLBACK_MODEL
      ? [normalizedModel]
      : [normalizedModel, FALLBACK_MODEL];

    let lastResult: (GeminiResult & { model: string }) | null = null;
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const result = await invokeModel(model);

        if (result.text) {
          if (model !== normalizedModel) {
            console.info(`Gemini fallback model ${model} produced the response.`);
          }
          return res.status(200).json({
            response: result.text,
            fallback: false,
            model,
            usedAlternateModel: model !== normalizedModel,
          });
        }

        lastResult = { ...result, model };
        console.warn(
          `Gemini model ${model} returned no text.`,
          JSON.stringify({
            finishReason: result.finishReason,
            blockReason: result.blockReason,
            safety: result.safetySummary,
            usage: result.json?.usageMetadata,
            responseId: result.json?.responseId,
          })
        );
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`Gemini API call failed for model ${model}:`, lastError.message);
      }
    }

    const composeFallbackMessage = (attempt?: GeminiResult & { model: string }) => {
      if (!attempt) return lastError?.message || "No response from AI";
      const segments = [
        attempt.blockReason ? `blocked (${attempt.blockReason})` : null,
        attempt.finishReason ? `finishReason: ${attempt.finishReason}` : null,
        attempt.safetySummary ? `safety: ${attempt.safetySummary}` : null,
      ].filter(Boolean);
      return segments.length
        ? `No text returned by Gemini — ${segments.join("; ")}`
        : "No response from AI";
    };

    if (parsedTemperature !== null) {
      const fallbackMessage = composeFallbackMessage(lastResult || undefined);
      const localInsight = buildLocalInsight(parsedTemperature, lastResult?.finishReason);
      console.warn(
        "Gemini returned no text after trying all models, using local fallback:",
        JSON.stringify({
          fallbackMessage,
          modelsTried: modelsToTry,
          lastSuccessfulModel: lastResult?.model,
          usage: lastResult?.json?.usageMetadata,
          responseId: lastResult?.json?.responseId,
          error: lastError?.message,
        })
      );
      return res.status(200).json({
        response: localInsight,
        fallback: true,
        model: "local",
        usedAlternateModel: false,
      });
    }

    const finalMessage = composeFallbackMessage(lastResult || undefined);
    console.error("Gemini failed with no usable response and no temperature provided:", finalMessage);

    // Try to list available models and automatically retry a few candidates before giving up.
    try {
      const listEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listEndpoint);
      if (listRes.ok) {
        const listJson = await listRes.json();
        const names: string[] = Array.isArray(listJson?.models)
          ? listJson.models.map((m: any) => m.name || m.model || String(m))
          : [];

        // Filter for Gemini flash-style models we might try
        const candidates = names.filter((n) => /^models\/gemini-/.test(n) && n !== normalizedModel && n !== FALLBACK_MODEL);

        // limit retries to first 3 candidates to avoid excessive calls
        for (const candidate of candidates.slice(0, 3)) {
          try {
            const attempt = await invokeModel(candidate);
            if (attempt.text) {
              console.info(`Gemini ListModels retry succeeded with ${candidate}`);
              return res.status(200).json({ response: attempt.text, fallback: false, model: candidate, usedAlternateModel: true });
            }
            console.warn(`Candidate ${candidate} returned no text; continuing.`);
          } catch (retryErr: any) {
            console.warn(`Retry with ${candidate} failed:`, retryErr?.message || retryErr);
          }
        }

        // If no candidate produced text, return available model names in the error to help pick one.
        return res.status(200).json({ error: finalMessage, availableModels: names });
      }
    } catch (listErr) {
      console.warn('ListModels call failed:', listErr);
    }

    return res.status(200).json({ error: finalMessage });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return res
      .status(500)
      .json({ error: err.message || "AI request failed" });
  }
}