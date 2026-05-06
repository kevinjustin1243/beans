import { useEffect } from "react";

/**
 * Sets document.title for the current page and restores the
 * previous title on unmount.
 *
 * @example
 * useTitle("Dashboard | MyApp");
 */
export function useTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
