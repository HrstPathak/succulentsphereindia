"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useUrlQueryParams } from "@/hooks/useUrlQueryParams";
import { ChatbotButton } from "./ChatbotButton";

const Chatbot = dynamic(() => import("./Chatbot"), { ssr: false });

export default function DeferredChatbot() {
  const { searchParams, setQueryParams } = useUrlQueryParams();
  const isOpen = useMemo(() => {
    const raw = String(searchParams.get("chat") || "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }, [searchParams]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !loaded) setLoaded(true);
  }, [isOpen, loaded]);

  const handleToggle = () => {
    if (!loaded) setLoaded(true);
    setQueryParams({ chat: isOpen ? null : "true" });
  };

  return (
    <>
      <ChatbotButton onClick={handleToggle} isOpen={isOpen} />
      {loaded ? <Chatbot hideLauncher /> : null}
    </>
  );
}
