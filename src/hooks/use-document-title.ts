import { useEffect } from "react";

const siteName = "Transparent";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${siteName}` : siteName;
  }, [title]);
}
