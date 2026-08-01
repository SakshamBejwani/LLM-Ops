type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  shouldRetry?: (error: unknown) => boolean;
};

function defaultShouldRetry(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  if (typeof statusCode === "number") {
    // Retry on server errors, not on bad requests / unknown model / etc.
    return statusCode >= 500;
  }
  // No status code usually means a network-level failure (ECONNREFUSED,
  // Ollama not running, connection reset) - worth retrying.
  return true;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 500, onRetry, shouldRetry = defaultShouldRetry } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }
      onRetry?.(attempt + 1, error);
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
