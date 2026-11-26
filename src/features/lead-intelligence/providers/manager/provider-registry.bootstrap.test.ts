import { afterEach, describe, expect, it } from "vitest";

import {
  ensureProviderRegistryBootstrapped,
  getProviderRegistry,
  resetProviderRegistrySingleton,
} from "@/features/lead-intelligence/providers/manager/provider-registry";

describe("ensureProviderRegistryBootstrapped", () => {
  afterEach(() => {
    resetProviderRegistrySingleton();
  });

  it("bootstraps the global registry when unset", () => {
    resetProviderRegistrySingleton();
    expect(() => getProviderRegistry()).toThrow(/niet geïnitialiseerd/i);

    const registry = ensureProviderRegistryBootstrapped();
    expect(registry).toBe(getProviderRegistry());
    expect(registry.getDefinitions().length).toBeGreaterThan(0);
  });

  it("returns the same singleton without re-registering factories", () => {
    resetProviderRegistrySingleton();
    const first = ensureProviderRegistryBootstrapped();
    const definitionCount = first.getDefinitions().length;
    const second = ensureProviderRegistryBootstrapped();

    expect(second).toBe(first);
    expect(second.getDefinitions()).toHaveLength(definitionCount);
  });
});