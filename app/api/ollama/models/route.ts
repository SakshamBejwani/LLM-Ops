import { NextResponse } from "next/server";
import { listOllamaModels } from "@/lib/ollama/provider";

export async function GET() {
  try {
    const models = await listOllamaModels();
    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
