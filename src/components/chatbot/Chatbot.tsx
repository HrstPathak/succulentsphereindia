"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ChatbotButton } from "./ChatbotButton";
import { ChatWindow } from "./ChatWindow";
import type { Message } from "./ChatMessage";
import { useUrlQueryParams } from "@/hooks/useUrlQueryParams";

export default function Chatbot({ hideLauncher = false }: { hideLauncher?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { searchParams, setQueryParams } = useUrlQueryParams();
  const isOpen = useMemo(() => {
    const raw = String(searchParams.get("chat") || "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }, [searchParams]);

  useEffect(() => {
    if (!isOpen && abortRef.current) abortRef.current.abort();
  }, [isOpen]);

  const isRecommendationIntent = (text: string) => {
    const normalized = text.toLowerCase();
    return (
      normalized.includes("recommend") ||
      normalized.includes("suggest") ||
      normalized.includes("which plant") ||
      normalized.includes("best plant") ||
      normalized.includes("plant for")
    );
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", isLoading: true },
      ]);
      setIsLoading(true);

      abortRef.current = new AbortController();
      try {
        const usePlantSuggestions = isRecommendationIntent(text);
        const endpoint = usePlantSuggestions ? "/api/plant-suggestions" : "/api/chat";
        const payload = usePlantSuggestions
          ? { message: text }
          : {
              message: text,
              history: messages
                .filter((m) => !m.isLoading)
                .map((m) => ({ role: m.role, content: m.content })),
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: abortRef.current.signal,
        });

        const data = await res.json();
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        const content = res.ok
          ? usePlantSuggestions
            ? suggestions.length > 0
              ? `Here are curated plant recommendations (${data?.source || "fallback"} ranking).`
              : "I couldn't find strong matches. Try adding budget, light, or care-level preferences."
            : data.message || "I couldn't generate a response."
          : [data.error, data.detail].filter(Boolean).join(" - ");
        const isHighLoad = !usePlantSuggestions && res.ok ? Boolean(data.isHighLoad) : false;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content,
                  isLoading: false,
                  isHighLoad,
                  suggestions: usePlantSuggestions ? suggestions : undefined,
                }
              : m
          )
        );
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, I couldn't respond. Please try again.", isLoading: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages]
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleClose = useCallback(() => {
    setQueryParams({ chat: null });
    if (abortRef.current) abortRef.current.abort();
  }, [setQueryParams]);

  const handleToggle = useCallback(() => {
    setQueryParams({ chat: isOpen ? null : "true" });
  }, [isOpen, setQueryParams]);

  return (
    <>
      {!hideLauncher ? <ChatbotButton onClick={handleToggle} isOpen={isOpen} /> : null}
      <ChatWindow
        isOpen={isOpen}
        onClose={handleClose}
        messages={messages}
        isLoading={isLoading}
        onSend={sendMessage}
        onQuickReply={handleQuickReply}
      />
    </>
  );
}
