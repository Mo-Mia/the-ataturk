export const ITERATIONS_PER_HALF = 450;
export const DEFAULT_PORT = 8005;

export function getPort(): number {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);
  return Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;
}
