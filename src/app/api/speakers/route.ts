import { NextRequest, NextResponse } from "next/server";
import { createSpeaker, listSpeakers } from "@/lib/monday/speakers";
import type { SpeakerInput } from "@/lib/monday/types";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/speakers?conferenceId=&cursor=&limit= — list speakers. */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const conferenceId = params.get("conferenceId") ?? undefined;
    const cursor = params.get("cursor") ?? undefined;
    const limitRaw = params.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const page = await listSpeakers({ conferenceId, cursor, limit });
    return NextResponse.json(page);
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/speakers — create a speaker. */
export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as SpeakerInput;
    const speaker = await createSpeaker(input);
    return NextResponse.json(speaker, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
