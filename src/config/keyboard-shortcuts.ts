export type KeyboardShortcut = {
  id: string;
  label: string;
  keys: string[];
  /** macOS display */
  display: string;
  group: "global" | "navigation" | "editor";
};

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { id: "command-palette", label: "Command palette", keys: ["Meta", "k"], display: "⌘ K", group: "global" },
  { id: "copilot", label: "Open AI Copilot", keys: ["Meta", "/"], display: "⌘ /", group: "global" },
  { id: "shortcuts-help", label: "Sneltoetsen", keys: ["?"], display: "?", group: "global" },
  { id: "sidebar", label: "Toggle sidebar", keys: ["Meta", "b"], display: "⌘ B", group: "global" },
  { id: "goto-dashboard", label: "Ga naar Dashboard", keys: ["g", "d"], display: "G D", group: "navigation" },
  { id: "goto-intelligence", label: "Ga naar Intelligence", keys: ["g", "i"], display: "G I", group: "navigation" },
  { id: "goto-companies", label: "Ga naar Companies", keys: ["g", "c"], display: "G C", group: "navigation" },
  { id: "goto-signals", label: "Ga naar Signals", keys: ["g", "s"], display: "G S", group: "navigation" },
  { id: "goto-outreach", label: "Ga naar Outreach", keys: ["g", "o"], display: "G O", group: "navigation" },
  { id: "goto-analytics", label: "Ga naar Analytics", keys: ["g", "a"], display: "G A", group: "navigation" },
  { id: "goto-settings", label: "Ga naar Settings", keys: ["g", ","], display: "G ,", group: "navigation" },
];

export const GOTO_ROUTES: Record<string, string> = {
  d: "/dashboard",
  i: "/intelligence",
  c: "/companies",
  s: "/signals",
  o: "/outreach",
  a: "/analytics",
  ",": "/settings",
};
