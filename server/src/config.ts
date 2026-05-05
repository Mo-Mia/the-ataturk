export const ITERATIONS_PER_HALF = 450;
export const REAL_TIME_ITERATION_DELAY_MS = 6_000;
export const FAST_FORWARD_ITERATION_DELAY_MS = 100;
export const DEFAULT_PORT = 8005;

/**
 * Resolve the HTTP server port from `PORT`, falling back to the project default.
 *
 * @returns Parsed port number, or DEFAULT_PORT when unset/invalid.
 */
export function getPort(): number {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);
  return Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;
}
