"use client";

import { motion } from "framer-motion";
import { CONTACT } from "./ChatbotButton";
import { formatCurrency } from "@/lib/currency";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  isHighLoad?: boolean;
  suggestions?: {
    title: string;
    handle: string;
    price: string;
    currency: string;
    reason: string;
    score: number;
  }[];
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-[var(--color-brand)] text-white rounded-br-md"
            : "bg-white/80 dark:bg-white/10 backdrop-blur-md text-[var(--color-text)] rounded-bl-md shadow-sm border border-white/20"
        }`}
      >
        {message.isLoading ? (
          <div className="flex gap-1 py-1">
            <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.content}
            </p>
            {Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
              <div className="mt-3 grid gap-2">
                {message.suggestions.map((item) => (
                  <a
                    key={item.handle}
                    href={`/products/${item.handle}`}
                    className="rounded-xl border border-[color:rgba(52,78,65,0.2)] bg-white/80 px-3 py-2 text-xs text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-bg)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <span className="rounded-full bg-[var(--color-secondary)]/35 px-2 py-0.5 text-[10px] font-medium">
                        {item.score}/100
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-80">{formatCurrency(item.price, item.currency || "INR")}</div>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">{item.reason}</p>
                  </a>
                ))}
              </div>
            )}
            {message.isHighLoad && (
              <div className="mt-3 flex gap-2">
                <a
                  href={`https://wa.me/${CONTACT.WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(
                    "Hi! I need faster assistance."
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full bg-[#25D366] text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M17.6915026,2.4744748 C15.6693616,0.559246 12.8124629,0 10.0151496,0 C4.50548941,0 0.11546504,4.40604706 0.11546504,9.89612521 C0.11546504,11.8102415 0.604154852,13.6982485 1.52273022,15.3640212 L0,24 L8.87192326,21.69253 C10.4693899,22.5315722 12.2604339,23.0157454 14.1383652,23.0157454 L14.1423978,23.0157454 C19.6504706,23.0157454 24,18.6095985 24,13.1195203 C24,10.3249843 23.4306751,7.4652151 21.4088336,5.54698689 L17.6915026,2.4744748 Z M14.1383652,21.0115273 C12.5274491,21.0115273 11.0474039,20.5590915 9.74077571,19.7607649 L9.41483309,19.5821449 L5.64303262,20.6346425 L6.72147318,17.1023718 L6.51701971,16.7621548 C5.60356722,15.3854176 5.11765022,13.726539 5.11765022,11.9958839 C5.11765022,7.02490947 9.17674171,3.01899347 14.1463536,3.01899347 C16.6928582,3.01899347 19.0543607,3.99036126 20.6798005,5.59915218 C22.3044611,7.20661156 23.2895249,9.56722901 23.2895249,12.1082968 C23.2895249,17.067377 19.2309281,21.0115273 14.1383652,21.0115273 Z M19.1823818,14.0924513 C18.8902817,13.9115165 17.3812618,13.1213859 17.1161671,13.0276211 C16.8501953,12.9363854 16.6547128,12.8915501 16.4600411,13.1811767 C16.2657893,13.4683213 15.7631024,14.0924513 15.5848043,14.2843656 C15.4069144,14.4759652 15.228899,14.5089713 14.9373029,14.3284865 C14.6451028,14.1481199 13.7206166,13.8432996 12.6375088,12.8771842 C11.7887128,12.1176767 11.1872768,11.1876959 11.0091868,10.8984515 C10.8314829,10.6107621 10.9939821,10.4426699 11.1748071,10.2635767 C11.3383249,10.1016221 11.5417881,9.84175626 11.7220032,9.66388849 C11.9019183,9.48634145 11.9988213,9.37268839 12.0911132,9.17843156 C12.1847597,8.98383 12.1392282,8.80625477 12.0456817,8.62579968 C11.9522425,8.44533458 11.348956,6.93810579 11.0846919,6.34339635 C10.8281799,5.77632227 10.5667915,5.86389487 10.3754975,5.85378911 C10.1921772,5.84424449 9.99710199,5.84318618 9.80229622,5.84318618 C9.60715209,5.84318618 9.27696693,5.91583215 9.01102055,6.20408979 C8.74507418,6.49160038 7.96927182,7.28095048 7.96927182,8.78766989 C7.96927182,10.2944699 9.03650948,11.7527627 9.2174239,11.9451857 C9.39794654,12.1359629 11.3411645,15.2124957 14.3282653,16.6485086 C15.0181899,16.9950413 15.5683239,17.2124275 16.0181899,17.3707797 C16.7063011,17.6107889 17.3329555,17.5797379 17.8266469,17.5044389 C18.3757152,17.4208485 19.3938555,16.8748557 19.6579975,16.2642324 C19.9221394,15.6534991 19.9221394,15.1393055 19.8286887,15.0060819 C19.7352381,14.8721564 19.5392357,14.7990141 19.1823818,14.0924513 Z" />
                  </svg>
                  WhatsApp
                </a>

                <a
                  href={`tel:${CONTACT.PHONE_NUMBER}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full bg-[#FF6B6B] text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Call
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
