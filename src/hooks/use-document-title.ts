import { useEffect } from "react";

const siteName = "Transparent";

/**
 * A single-page app never reloads, so the `<title>` in `index.html` is the only
 * one a browser tab, a history entry or a screen reader ever sees — every route
 * would answer "Transparent" (2.4.2 Page Titled). Each page states its own
 * first, the site name second, so the distinguishing half survives the
 * truncation a narrow tab does.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${siteName}` : siteName;
  }, [title]);
}
