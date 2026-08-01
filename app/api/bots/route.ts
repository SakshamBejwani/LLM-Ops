import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const createBotSchema = z.object({
  name: z.string().min(1).max(100),
  system_prompt: z.string().max(8000).default(""),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  tool_ids: z.array(z.string()).default([]),
});

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bots: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("bots").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bot: data }, { status: 201 });
}
