import { NextResponse } from "next/server";

import { createCandidateMatchingService } from "@/features/candidate-matching/create-candidate-matching-service";
import { toCandidateId } from "@/features/candidates/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { mapVacancyErrorToStatus } from "@/lib/vacancies/api-errors";
import {
  vacancyMatchBodySchema,
  vacancyMatchParamsSchema,
} from "@/lib/validations/candidate-matching-api";

type RouteParams = { params: Promise<{ vacancyId: string }> };

export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const routeParams = await params;
  const parsedParams = vacancyMatchParamsSchema.safeParse(routeParams);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: parsedParams.error.issues[0]?.message ?? "Ongeldige vacature" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsedBody = vacancyMatchBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Ongeldige invoer" },
      { status: 400 },
    );
  }

  try {
    const matchingService = await createCandidateMatchingService();
    const result = await matchingService.matchCandidateToVacancy(
      {
        organizationId: context.organizationId,
        userId: context.userId,
      },
      {
        vacancyId: toVacancyId(parsedParams.data.vacancyId),
        candidateId: parsedBody.data.candidateId
          ? toCandidateId(parsedBody.data.candidateId)
          : undefined,
        candidate: parsedBody.data.candidate,
        companyName: parsedBody.data.companyName ?? null,
      },
    );

    console.log("[CandidateMatching] match completed", {
      vacancyId: result.vacancyId,
      matchScore: result.match.matchScore,
      candidateName: result.candidateName,
    });

    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapVacancyErrorToStatus(error);
    if (mapped.status >= 500) {
      console.error("[CandidateMatching] match failed", error);
    }
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
