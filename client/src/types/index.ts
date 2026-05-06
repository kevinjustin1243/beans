import type { ReactNode } from "react";

/** Generic wrapper for components that accept children */
export interface WithChildren {
  children: ReactNode;
}

/** Shape of a navigation link entry */
export interface NavItem {
  label: string;
  to: string;
}

