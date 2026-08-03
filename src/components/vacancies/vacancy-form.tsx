"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyOption, VacancyFormValues } from "@/components/vacancies/types";

const vacancyFormSchema = z
  .object({
    companyId: z.string().uuid("Selecteer een bedrijf."),
    title: z
      .string()
      .trim()
      .min(1, "Functietitel is verplicht.")
      .max(200, "Functietitel is te lang."),
    description: z.string().max(10000, "Omschrijving is te lang.").optional(),
    location: z.string().max(200, "Locatie is te lang.").optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "temporary"]),
    salaryMin: z.string().optional(),
    salaryMax: z.string().optional(),
    requirements: z.string().max(10000, "Vereisten zijn te lang.").optional(),
    status: z.enum(["draft", "open", "on_hold", "closed"]),
  })
  .superRefine((values, context) => {
    const min = parseOptionalSalary(values.salaryMin);
    const max = parseOptionalSalary(values.salaryMax);

    if (min != null && min < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimumsalaris mag niet negatief zijn.",
        path: ["salaryMin"],
      });
    }

    if (max != null && max < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximumsalaris mag niet negatief zijn.",
        path: ["salaryMax"],
      });
    }

    if (min != null && max != null && max < min) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximumsalaris mag niet lager zijn dan minimumsalaris.",
        path: ["salaryMax"],
      });
    }
  });

function parseOptionalSalary(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value.replace(/\s/g, ""));

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

type VacancyFormSchemaValues = z.infer<typeof vacancyFormSchema>;

type VacancyFormProps = {
  companies: CompanyOption[];
  defaultValues?: Partial<VacancyFormValues>;
  submitLabel: string;
  onSubmit: (payload: {
    companyId: string;
    title: string;
    description?: string | null;
    location?: string | null;
    employmentType: VacancyFormValues["employmentType"];
    salaryMin?: number | null;
    salaryMax?: number | null;
    requirements?: string | null;
    status: VacancyFormValues["status"];
  }) => Promise<void>;
};

export function VacancyForm({
  companies,
  defaultValues,
  submitLabel,
  onSubmit,
}: VacancyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VacancyFormSchemaValues>({
    resolver: zodResolver(vacancyFormSchema),
    defaultValues: {
      companyId: defaultValues?.companyId ?? "",
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      location: defaultValues?.location ?? "",
      employmentType: defaultValues?.employmentType ?? "full_time",
      salaryMin: defaultValues?.salaryMin ?? "",
      salaryMax: defaultValues?.salaryMax ?? "",
      requirements: defaultValues?.requirements ?? "",
      status: defaultValues?.status ?? "draft",
    },
  });

  async function handleValidSubmit(values: VacancyFormSchemaValues) {
    try {
      await onSubmit({
        companyId: values.companyId,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        location: values.location?.trim() || null,
        employmentType: values.employmentType,
        salaryMin: parseOptionalSalary(values.salaryMin),
        salaryMax: parseOptionalSalary(values.salaryMax),
        requirements: values.requirements?.trim() || null,
        status: values.status,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Er ging iets mis. Probeer het opnieuw.",
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleValidSubmit)}
      className="space-y-6 rounded-xl border bg-card p-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="companyId">Bedrijf *</Label>
          <select
            id="companyId"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            aria-invalid={Boolean(errors.companyId)}
            {...register("companyId")}
          >
            <option value="">Selecteer bedrijf</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          {errors.companyId ? (
            <p className="text-sm text-destructive">{errors.companyId.message}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Functietitel *</Label>
          <Input id="title" aria-invalid={Boolean(errors.title)} {...register("title")} />
          {errors.title ? (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Omschrijving</Label>
          <Textarea id="description" rows={5} {...register("description")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Locatie</Label>
          <Input id="location" {...register("location")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employmentType">Dienstverband</Label>
          <select
            id="employmentType"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            {...register("employmentType")}
          >
            <option value="full_time">Fulltime</option>
            <option value="part_time">Parttime</option>
            <option value="contract">Contract</option>
            <option value="temporary">Tijdelijk</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="salaryMin">Minimumsalaris (€)</Label>
          <Input id="salaryMin" type="number" min={0} step={100} {...register("salaryMin")} />
          {errors.salaryMin ? (
            <p className="text-sm text-destructive">{errors.salaryMin.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="salaryMax">Maximumsalaris (€)</Label>
          <Input id="salaryMax" type="number" min={0} step={100} {...register("salaryMax")} />
          {errors.salaryMax ? (
            <p className="text-sm text-destructive">{errors.salaryMax.message}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="requirements">Vereisten</Label>
          <Textarea id="requirements" rows={4} {...register("requirements")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            {...register("status")}
          >
            <option value="draft">Concept</option>
            <option value="open">Open</option>
            <option value="on_hold">On hold</option>
            <option value="closed">Gesloten</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting || companies.length === 0}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Opslaan…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
