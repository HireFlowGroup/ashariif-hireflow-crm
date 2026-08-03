import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkspacePageProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bleed?: boolean;
};

/** Linear-style page shell — minimal chrome, max content density */
export function WorkspacePage({
  title,
  description,
  actions,
  children,
  className,
  bleed = false,
}: WorkspacePageProps) {
  return (
    <div className={cn("flex flex-1 flex-col", className)}>
      <div className={cn("border-b border-border/60 px-4 py-4 md:px-6", bleed && "px-0 md:px-0")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("flex-1 p-4 md:p-6", bleed && "p-0")}>{children}</div>
    </div>
  );
}
