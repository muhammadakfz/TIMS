import { useEffect, useRef, useState } from "react";

type InsightStatus = "idle" | "loading" | "ready" | "error";

type AiInsightProps = {
  temperature: number | null;
  sensorLoading: boolean;
};

type AiResponse = {
  response?: string;
  error?: string;
  fallback?: boolean;
  model?: string;
  usedAlternateModel?: boolean;
};

export default function AiInsight({ temperature, sensorLoading }: AiInsightProps) {
  const [status, setStatus] = useState<InsightStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const [modelSource, setModelSource] = useState<string>("");
  const [usedAlternateModel, setUsedAlternateModel] = useState<boolean>(false);
  const displayModel = modelSource.startsWith("models/")
    ? modelSource.replace(/^models\//, "")
    : modelSource;
  const lastFetchedTemp = useRef<number | null>(null);

  useEffect(() => {
    if (sensorLoading) {
      setStatus("idle");
      setMessage("");
      setError("");
      setUsedFallback(false);
      setModelSource("");
      setUsedAlternateModel(false);
      return;
    }

    if (temperature === null || Number.isNaN(temperature)) {
      setStatus("error");
      setMessage("");
      setError("Tidak ada data suhu yang tersedia.");
      setUsedFallback(false);
      setModelSource("");
      setUsedAlternateModel(false);
      lastFetchedTemp.current = null;
      return;
    }

    if (lastFetchedTemp.current === temperature) {
      return;
    }

    const controller = new AbortController();
    const fetchInsight = async () => {
      try {
        setStatus("loading");
        setError("");
        setUsedFallback(false);
        setModelSource("");
        setUsedAlternateModel(false);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temperature }),
          signal: controller.signal,
        });

        const data: AiResponse = await res.json();

        if (!res.ok || data.error) {
          const messageFromApi = data.error || "AI tidak dapat memberikan penjelasan saat ini.";
          throw new Error(messageFromApi);
        }

        lastFetchedTemp.current = temperature;
        setMessage(data.response || "");
        setUsedFallback(Boolean(data.fallback));
        setModelSource(data.model || "");
        setUsedAlternateModel(Boolean(data.usedAlternateModel));
        setStatus("ready");
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage("");
        setError(err.message || "Terjadi kesalahan saat meminta AI.");
        setUsedFallback(false);
        setModelSource("");
        setUsedAlternateModel(false);
        lastFetchedTemp.current = null;
      }
    };

    fetchInsight();

    return () => {
      controller.abort();
    };
  }, [temperature, sensorLoading]);

  const renderContent = () => {
    if (sensorLoading) {
      return <p className="text-gray-300">Menunggu data sensor…</p>;
    }

    if (status === "loading") {
      return (
        <div className="flex items-center gap-3 text-gray-200">
          <svg
            className="h-5 w-5 animate-spin text-blue-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>AI sedang menganalisis kondisi ruangan…</span>
        </div>
      );
    }

    if (status === "error") {
      return <p className="text-red-300">{error}</p>;
    }

    if (status === "ready" && message) {
      return (
        <div className="text-gray-100 leading-relaxed space-y-2">
          <p>{message}</p>
          {usedFallback && (
            <p className="text-xs text-white/60">(Ringkasan lokal ditampilkan karena respons Gemini kosong)</p>
          )}
          {!usedFallback && modelSource && (
            <p className="text-xs text-white/60">
              {usedAlternateModel
                ? `Respons dari model cadangan ${displayModel || "Gemini"}.`
                : `Respons dari model ${displayModel || "Gemini"}.`}
            </p>
          )}
        </div>
      );
    }

    return (
      <p className="text-gray-300">
        AI siap memberikan penjelasan ketika data suhu terbaru diterima.
      </p>
    );
  };

  return (
    <section className="w-full bg-white/10 border border-white/10 rounded-xl p-5 mt-4 text-sm shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Analisis AI</h3>
        {temperature !== null && !Number.isNaN(temperature) && (
          <span className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded-md">
            {temperature.toFixed(1)}°C
          </span>
        )}
      </div>
      {renderContent()}
    </section>
  );
}
