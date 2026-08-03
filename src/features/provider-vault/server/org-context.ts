import "server-only";
import { AsyncLocalStorage } from "async_hooks";

const organizationContext = new AsyncLocalStorage<string>();

export function runWithOrganizationId<T>(organizationId: string, fn: () => T): T {
  return organizationContext.run(organizationId, fn);
}

export async function runWithOrganizationIdAsync<T>(
  organizationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return organizationContext.run(organizationId, fn);
}

export function getActiveOrganizationId(): string | undefined {
  return organizationContext.getStore();
}

/** Sets org context for current execution tree (incl. async generators). */
export function enterOrganizationContext(organizationId: string): void {
  organizationContext.enterWith(organizationId);
}
