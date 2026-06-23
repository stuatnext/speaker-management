/**
 * Thin GraphQL client for the monday.com API.
 *
 * The API token is read from the environment and never exposed to the browser —
 * all calls go through Next.js route handlers (server-side only).
 */

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_VERSION = "2024-10";

export class MondayError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "MondayError";
    this.status = status;
    this.details = details;
  }
}

function getToken(): string {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new MondayError(
      "MONDAY_API_TOKEN is not configured. Copy .env.example to .env.local and set it.",
      500,
    );
  }
  return token;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
  error_message?: string;
}

/**
 * Run a GraphQL query/mutation against the monday.com API.
 *
 * @throws {MondayError} when the network call fails or the API returns errors.
 */
export async function mondayQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
        "API-Version": MONDAY_API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
  } catch (err) {
    throw new MondayError(
      `Failed to reach the monday.com API: ${(err as Error).message}`,
      502,
    );
  }

  let body: GraphQLResponse<T>;
  try {
    body = (await res.json()) as GraphQLResponse<T>;
  } catch {
    throw new MondayError("monday.com returned a non-JSON response", res.status);
  }

  if (!res.ok || body.errors?.length || body.error_message) {
    const message =
      body.errors?.map((e) => e.message).join("; ") ||
      body.error_message ||
      `monday.com API error (HTTP ${res.status})`;
    throw new MondayError(message, res.ok ? 502 : res.status, body.errors);
  }

  if (!body.data) {
    throw new MondayError("monday.com response contained no data", 502);
  }

  return body.data;
}
