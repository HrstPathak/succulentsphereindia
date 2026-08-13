import { NextRequest, NextResponse } from "next/server";
import { generatePlantSuggestions } from "@/lib/plant-suggestions";

type SuggestionPayload = {
  message?: string;
};

function sanitizeInput(text: string): string {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export async function POST(request: NextRequest) {
  let body: SuggestionPayload;
  try {
    body = (await request.json()) as SuggestionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = sanitizeInput(body?.message || "");
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  try {
    const result = await generatePlantSuggestions(message);
    return NextResponse.json({
      suggestions: result.suggestions,
      source: result.source,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Unable to generate plant suggestions." },
      { status: 500 }
    );
  }
}
