/** Shared helpers for route handlers. */

import { NextResponse } from "next/server";
import { MondayError } from "./monday/client";

/** Convert a thrown error into a JSON error response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof MondayError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
