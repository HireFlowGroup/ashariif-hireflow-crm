/** Run async tasks with concurrency; never throws — returns allSettled-style results. */
export async function runWithConcurrencySettled<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }>> {
  if (tasks.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, tasks.length));
  const results: Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }> =
    new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        const value = await tasks[currentIndex]!();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  await Promise.allSettled(Array.from({ length: limit }, () => worker()));
  return results;
}
