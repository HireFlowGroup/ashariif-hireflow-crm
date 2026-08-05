import { describe, expect, it } from "vitest";

import type { CommercialPipelineCard } from "@/features/commercial-pipeline/domain/types";
import { buildPipelineBoard } from "@/features/commercial-pipeline/repositories/commercial-pipeline.repository";

function makeCard(
  overrides: Partial<CommercialPipelineCard> & Pick<CommercialPipelineCard, "id" | "stage" | "companyName">,
): CommercialPipelineCard {
  return {
    organizationId: "org-1",
    companyId: "company-1",
    position: 0,
    sector: null,
    city: null,
    contactName: null,
    contactEmail: null,
    leadScore: null,
    dealValue: null,
    notes: null,
    sourceRunItemId: null,
    lostReason: null,
    movedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPipelineBoard", () => {
  it("groups cards by stage with Dutch labels and counts", () => {
    const board = buildPipelineBoard([
      makeCard({ id: "1", stage: "nieuw", companyName: "Alpha", position: 1 }),
      makeCard({ id: "2", stage: "nieuw", companyName: "Beta", position: 0 }),
      makeCard({ id: "3", stage: "mail_verzonden", companyName: "Gamma", position: 0 }),
    ]);

    expect(board.totalCards).toBe(3);
    expect(board.stageCounts.nieuw).toBe(2);
    expect(board.stageCounts.mail_verzonden).toBe(1);
    expect(board.stageCounts.plaatsing).toBe(0);

    const nieuwColumn = board.columns.find((column) => column.stage === "nieuw");
    expect(nieuwColumn?.label).toBe("Nieuw");
    expect(nieuwColumn?.count).toBe(2);
    expect(nieuwColumn?.cards.map((card) => card.companyName)).toEqual(["Beta", "Alpha"]);
  });

  it("includes all 13 pipeline stages", () => {
    const board = buildPipelineBoard([]);
    expect(board.columns).toHaveLength(13);
    expect(board.columns.map((column) => column.label)).toContain("Vacature ontvangen");
    expect(board.columns.map((column) => column.label)).toContain("Verloren");
  });
});
