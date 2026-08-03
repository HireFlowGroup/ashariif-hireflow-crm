declare module "playwright" {
  export const chromium: {
    launch(options: { headless: boolean }): Promise<{
      newPage(): Promise<{
        goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>;
        content(): Promise<string>;
        evaluate<T>(fn: () => T): Promise<T>;
      }>;
      close(): Promise<void>;
    }>;
  };
}
