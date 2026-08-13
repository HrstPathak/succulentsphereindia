"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, type Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

const QUICK_REPLIES = [
  "Plant Care Tips",
  "Shipping Info",
  "Recommend a Plant",
  "Suggest a low-light succulent under $30",
  "Contact / About",
];

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onQuickReply?: (text: string) => void;
}

export function ChatWindow({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSend,
  onQuickReply,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="fixed bottom-24 right-4 z-50 flex max-h-[calc(100vh-10rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/55 shadow-[0_26px_60px_rgba(23,34,29,0.28)] backdrop-blur-2xl dark:border-[color:rgba(143,191,148,0.24)] dark:bg-[#0a1a24]/58 md:bottom-28 md:right-8 md:w-[390px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/35 dark:border-[color:rgba(143,191,148,0.2)] bg-white/45 dark:bg-[#0f2531]/56 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">🌿</span>
                <h2 className="font-serif text-base font-semibold text-[var(--color-text)]">
                  Succulent Sphere Assistant
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text)] transition-colors"
                aria-label="Close chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[320px]"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)" }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Hi! I can help with plant care, products, and shopping. Ask me anything 🌱
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {QUICK_REPLIES.map((text) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => onQuickReply?.(text)}
                        className="px-3 py-1.5 text-xs rounded-full border border-white/45 dark:border-[color:rgba(143,191,148,0.28)] text-[var(--color-text)] bg-white/62 dark:bg-[#102732]/62 hover:bg-[var(--color-brand)] hover:text-[var(--color-bg)] hover:border-transparent transition-colors"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/35 dark:border-[color:rgba(143,191,148,0.2)] bg-white/44 dark:bg-[#0f2430]/56 backdrop-blur-xl">
              <ChatInput onSend={onSend} disabled={isLoading} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
