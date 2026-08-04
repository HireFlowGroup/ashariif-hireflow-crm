import {
  BarChart3,
  Bot,
  BrainCircuit,
  Briefcase,
  Building2,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  Radar,
  Radio,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Keyboard hint shown in sidebar / command palette */
  shortcut?: string;
  keywords?: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Overzicht",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Realtime hiring intelligence en warme leads",
        shortcut: "G D",
        keywords: ["home", "start", "overzicht"],
      },
      {
        title: "Intelligence",
        href: "/intelligence",
        icon: Radio,
        description: "Live feed — signals, scores, AI analyses",
        shortcut: "G I",
        keywords: ["feed", "today", "nieuws", "updates"],
      },
      {
        title: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "Trends, conversies en pipeline metrics",
        shortcut: "G A",
        keywords: ["stats", "metrics", "rapportage"],
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        title: "Companies",
        href: "/companies",
        icon: Building2,
        description: "Bedrijven, hiring signals en outreach",
        shortcut: "G C",
        keywords: ["bedrijven", "clients", "accounts"],
      },
      {
        title: "Candidates",
        href: "/candidates",
        icon: UserRound,
        description: "Talent pool en kandidaatprofielen",
        keywords: ["kandidaten", "talent"],
      },
      {
        title: "Signals",
        href: "/signals",
        icon: Radar,
        description: "Alle hiring signals over bedrijven",
        shortcut: "G S",
        keywords: ["hiring", "vacatures", "alerts"],
      },
      {
        title: "Vacatures",
        href: "/vacancies",
        icon: Briefcase,
        description: "Open rollen per bedrijf",
        keywords: ["jobs", "openings"],
      },
      {
        title: "Outreach",
        href: "/outreach",
        icon: Megaphone,
        description: "Outreach queue, drafts en follow-ups",
        shortcut: "G O",
        keywords: ["email", "linkedin", "contact"],
      },
      {
        title: "Tasks",
        href: "/tasks",
        icon: ListTodo,
        description: "Follow-ups en teamacties",
        keywords: ["taken", "todo"],
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      {
        title: "AI Copilot",
        href: "/copilot",
        icon: BrainCircuit,
        description: "Recruitment intelligence assistant",
        shortcut: "⌘ /",
        keywords: ["chat", "assistant", "vraag"],
      },
      {
        title: "AI Recruiter",
        href: "/ai-recruiter",
        icon: Bot,
        description: "Autonome prospectresearch en outreach-voorbereiding",
        shortcut: "G R",
        keywords: ["recruiter", "automation", "run", "prospects"],
      },
    ],
  },
];

/** Flat list for command palette & route guards */
export const mainNav: NavItem[] = navGroups.flatMap((group) => group.items);

export const settingsNav: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Providers, diagnostics en intelligence scheduler",
    shortcut: "G ,",
    keywords: ["instellingen", "config"],
  },
];

export const authRoutes = {
  login: "/login",
} as const;

export const defaultAuthenticatedRoute = "/dashboard";

/** Extra protected prefixes not in main nav */
const protectedPrefixes = [
  "/companies/",
  "/vacancies/",
  "/settings/",
  "/intelligence/",
  "/copilot",
  "/ai-recruiter",
  "/contacts",
  "/pipeline",
];

export function isAuthRoute(pathname: string): boolean {
  return pathname === authRoutes.login;
}

export function isProtectedRoute(pathname: string): boolean {
  const allRoutes = [...mainNav, ...settingsNav];

  if (
    allRoutes.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
  ) {
    return true;
  }

  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function findNavItem(pathname: string): NavItem | undefined {
  return [...mainNav, ...settingsNav].find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export type CommandAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  group: "navigation" | "actions" | "ai" | "recent";
  onSelect?: () => void;
};

export function buildNavigationCommands(): CommandAction[] {
  return [...mainNav, ...settingsNav].map((item) => ({
    id: `nav-${item.href}`,
    label: item.title,
    description: item.description,
    href: item.href,
    icon: item.icon,
    shortcut: item.shortcut,
    keywords: item.keywords,
    group: item.href === "/copilot" ? "ai" : "navigation",
  }));
}

export const quickActions: CommandAction[] = [
  {
    id: "action-new-company-search",
    label: "Zoek bedrijven met AI",
    description: "Natural language company finder",
    href: "/companies?finder=1",
    group: "actions",
    keywords: ["finder", "zoek", "discover"],
  },
  {
    id: "action-new-vacancy",
    label: "Nieuwe vacature",
    description: "Vacature toevoegen",
    href: "/vacancies/new",
    group: "actions",
    keywords: ["create", "job"],
  },
  {
    id: "action-intelligence-feed",
    label: "Open intelligence feed",
    description: "Live updates stream",
    href: "/intelligence",
    group: "actions",
  },
  {
    id: "action-ask-copilot",
    label: "Vraag AI Copilot",
    description: "Stel een recruitment vraag",
    href: "/copilot",
    group: "ai",
    shortcut: "⌘ /",
    keywords: ["chat", "help"],
  },
];
