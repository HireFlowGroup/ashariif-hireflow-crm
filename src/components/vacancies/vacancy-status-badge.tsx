import { Badge } from "@/components/ui/badge";
import type { VacancyStatus } from "@/features/vacancies/domain";
import { formatVacancyStatus } from "@/lib/vacancies/format";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  VacancyStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  open: "default",
  on_hold: "outline",
  closed: "destructive",
};

type VacancyStatusBadgeProps = {
  status: VacancyStatus;
  className?: string;
};

export function VacancyStatusBadge({ status, className }: VacancyStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} className={cn(className)}>
      {formatVacancyStatus(status)}
    </Badge>
  );
}
