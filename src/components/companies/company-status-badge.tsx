import { Badge } from "@/components/ui/badge";
import type { CompanyStatus } from "@/features/companies/domain";
import { formatCompanyStatus } from "@/lib/companies/format";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  CompanyStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  prospect: "secondary",
  inactive: "outline",
  archived: "destructive",
};

type CompanyStatusBadgeProps = {
  status: CompanyStatus;
  className?: string;
};

export function CompanyStatusBadge({ status, className }: CompanyStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} className={cn(className)}>
      {formatCompanyStatus(status)}
    </Badge>
  );
}
