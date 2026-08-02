import { NextRequest, NextResponse } from "next/server";
import { fetchAllBots } from "@/lib/chat/run";
import { listToolOptions } from "@/lib/tools";

export async function GET(request: NextRequest) {
  const excludeBotId = request.nextUrl.searchParams.get("excludeBotId") ?? undefined;
  const allBots = await fetchAllBots();
  const tools = await listToolOptions(allBots, excludeBotId);
  return NextResponse.json({ tools });
}
