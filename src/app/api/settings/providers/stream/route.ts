import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createVaultForContext, withProviderVaultContext } from "@/features/provider-vault/server";

const POLL_INTERVAL_MS = 3000;
const MAX_DURATION_MS = 5 * 60 * 1000;

export async function GET(): Promise<Response> {
  const auth = await getAuthenticatedServiceContext();

  if (!auth) {
    return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), { status: 401 });
  }

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { organizationId: auth.organizationId });

      while (Date.now() - started < MAX_DURATION_MS) {
        try {
          await withProviderVaultContext(auth, async () => {
            const vault = await createVaultForContext(auth);
            const providers = await vault.getProviderSnapshots(auth.organizationId);
            send("providers", { providers, timestamp: new Date().toISOString() });
          });
        } catch (error) {
          send("error", {
            message: error instanceof Error ? error.message : "Stream fout",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
