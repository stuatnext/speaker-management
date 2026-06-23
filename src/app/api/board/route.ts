import { NextResponse } from "next/server";
import { getBoardMeta } from "@/lib/monday/speakers";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/board — board metadata for filters and forms. */
export async function GET() {
  try {
    const meta = await getBoardMeta();
    return NextResponse.json(meta);
  } catch (err) {
    return errorResponse(err);
  }
}
