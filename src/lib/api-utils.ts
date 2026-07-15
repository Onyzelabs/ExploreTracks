/**
 * Shared error class for API route failures.
 * Carries an HTTP status code and machine-readable code for the client.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Wraps a Next.js Route Handler with consistent error formatting.
 * All unhandled errors are caught and returned as { success: false } JSON.
 */
export function withErrorHandler(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          { success: false, error: err.message, code: err.code },
          { status: err.statusCode }
        );
      }
      console.error("[API] Unhandled error:", err);
      return Response.json(
        { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  };
}

/**
 * Reads and validates required environment variables at startup.
 * Throws at build/request time if any are missing.
 */
export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new ApiError(
      `Missing required environment variable: ${key}`,
      500,
      "MISSING_ENV"
    );
  }
  return val;
}

/**
 * Returns true if the application is running in a production-like environment.
 */
export const isProd = process.env.NODE_ENV === "production";
