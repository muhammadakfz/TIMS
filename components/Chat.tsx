// pages/Chat.tsx atau components/Chat.tsx

import { useState, useRef, useEffect } from "react";

type ChatMessage = {
  role: "user" | "model";
  text: string;
};

export default function Chat() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  
  // [BARU] Ref untuk div kontainer chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // [BARU] Fungsi untuk auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // [BARU] useEffect untuk trigger auto-scroll setiap kali messages berubah
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendConversation = async (conversation: ChatMessage[]) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    });
    // [IMPROVEMENT] Error handling jika response bukan JSON
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "API request failed");
    }
    return res.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return; // [IMPROVEMENT] Mencegah submit ganda saat loading

    const userMsg: ChatMessage = { role: "user", text: trimmed };
    const nextConversation = [...messages, userMsg];
    setMessages(nextConversation);
    setPrompt("");
    setLoading(true);

    try {
      const data = await sendConversation(nextConversation);
      if (data.response) {
        setMessages((prev) => [...prev, { role: "model", text: data.response }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "model", text: `Error: ${data.error || "Unknown error"}` },
        ]);
      }
    } catch (err: any) {
       // [IMPROVEMENT] Menampilkan error yang lebih jelas dari API
      let errorMessage = "An unexpected error occurred.";
      try {
        // Coba parse error jika formatnya JSON dari API kita
        const errorJson = JSON.parse(err.message);
        errorMessage = errorJson.error || err.message;
      } catch {
        errorMessage = err.message;
      }
       setMessages((prev) => [
        ...prev,
        { role: "model", text: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setPrompt("");
  };

  return (
    <div className="w-full max-w-md mt-8">
      {/* [IMPROVEMENT] Container dibuat lebih tinggi dan scrollable */}
      <div className="bg-black/30 backdrop-blur-md rounded-xl p-4 shadow-lg text-sm text-white h-96 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-gray-300 italic">
            Ask TIMS AI anything about the system...
          </p>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`mb-2 ${
              m.role === "model" ? "text-green-300" : "text-blue-200"
            }`}
          >
            <strong>{m.role === "model" ? "AI:" : "You:"}</strong> {m.text}
          </div>
        ))}
        {/* [BARU] Elemen kosong sebagai target scroll */}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-2 flex">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 rounded-l-lg px-4 py-2 focus:outline-none bg-white/90 text-gray-900 placeholder-gray-500"
          placeholder={loading ? "Waiting for response…" : "Ask something..."}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()} // [IMPROVEMENT] Tombol nonaktif jika input kosong
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Send"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-r-lg"
        >
          Reset
        </button>
      </form>
    </div>
  );
}