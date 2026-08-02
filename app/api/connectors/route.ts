import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CONNECTOR_TYPES, connectorConfigSchema } from "@/lib/connectors/types";

const createConnectorSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  type: z.enum(CONNECTOR_TYPES as [string, ...string[]]),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("connectors")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connectors: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createConnectorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const configParsed = connectorConfigSchema.safeParse({ type: parsed.data.type, config: parsed.data.config });
  if (!configParsed.success) {
    return NextResponse.json({ error: configParsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("connectors").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connector: data }, { status: 201 });
}
