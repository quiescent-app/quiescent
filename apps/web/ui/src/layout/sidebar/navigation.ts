import { BookOpen, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const mainNavigation: NavigationItem[] = [
  {
    label: "Library",
    path: "/library",
    icon: BookOpen,
  },
];

export const bottomNavigation: NavigationItem[] = [
  {
    label: "Account",
    path: "/account",
    icon: UserRound,
  },
  {
    label: "Setting",
    path: "/setting",
    icon: BookOpen,
  },
];
