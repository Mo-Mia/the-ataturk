export function isTransientGeminiError(error: unknown): boolean {
  const status = statusFromGeminiError(error);

  if (status !== null) {
    return status === 429 || status >= 500;
  }

  if (error instanceof Error) {
    return (
      error.name === "APIConnectionError" ||
      error.name === "APIConnectionTimeoutError" ||
      error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timeout")
    );
  }

  return false;
}

export function statusFromGeminiError(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const directStatus = (error as { status?: unknown }).status;
  if (typeof directStatus === "number") {
    return directStatus;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number") {
    return statusCode;
  }

  return null;
}
