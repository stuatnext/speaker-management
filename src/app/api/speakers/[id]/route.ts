import { NextRequest, NextResponse } from "next/server";
import { deleteSpeaker, getSpeaker, updateSpeaker } from "@/lib/monday/speakers";
import type { SpeakerInput } from "@/lib/monday/types";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/** GET /api/speakers/:id — fetch a single speaker. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const speaker = await getSpeaker(params.id);
    if (!speaker) {
      return NextResponse.json({ error: "Speaker not found" }, { status: 404 });
    }
    return NextResponse.json(speaker);
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/speakers/:id — update a speaker. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const input = (await req.json()) as SpeakerInput;
    const speaker = await updateSpeaker(params.id, input);
    return NextResponse.json(speaker);
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/speakers/:id — remove a speaker. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await deleteSpeaker(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
