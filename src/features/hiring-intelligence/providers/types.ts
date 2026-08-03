import type {
  CollectSignalsContext,
  CollectSignalsCriteria,
  IncomingHiringSignal,
} from "@/features/hiring-intelligence/domain/signal-types";

/** Modular signal provider — each external source implements this interface. */
export interface HiringSignalProvider {
  readonly id: string;
  readonly displayName: string;
  readonly order: number;
  readonly enabled: boolean;
  readonly skipReason?: string;

  collectSignals(
    criteria: CollectSignalsCriteria,
    context: CollectSignalsContext,
  ): Promise<IncomingHiringSignal[]>;
}

export type SignalProviderRegistryEntry = {
  name: string;
  enabled: boolean;
  reason?: string;
};
