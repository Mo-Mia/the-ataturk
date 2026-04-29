export async function withEngineConsoleMuted<T>(operation: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  console.log = () => undefined;

  try {
    return await operation();
  } finally {
    console.log = originalLog;
  }
}
