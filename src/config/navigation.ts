import {
  Bot,
  Building2,
  Contact,
  Kanban,
  LayoutDashboard,
  ListTodo,
  UserRound,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const mainNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview of your recruitment pipeline",
  },
  {
    title: "Companies",
    href: "/companies",
    icon: Building2,
    description: "Client organizations and accounts",
  },
  {
    title: "Contacts",
    href: "/contacts",
    icon: Contact,
    description: "Hiring managers and client stakeholders",
  },
  {
    title: "Candidates",
    href: "/candidates",
    icon: UserRound,
    description: "Talent pool and applicant profiles",
  },
  {
    title: "Vacancies",
    href: "/vacancies",
    icon: Briefcase,
    description: "Open roles and job requisitions",
  },
  {
    title: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    description: "Stage-based hiring workflow",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListTodo,
    description: "Follow-ups and team action items",
  },
  {
    title: "AI Assistant",
    href: "/ai-assistant",
    icon: Bot,
    description: "AI-powered recruiting support",
  },
];

export const authRoutes = {
  login: "/login",
} as const;

export const defaultAuthenticatedRoute = "/dashboard";

export function isAuthRoute(pathname: string): boolean {
  return pathname === authRoutes.login;
}

export function isProtectedRoute(pathname: string): boolean {
  return mainNav.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
