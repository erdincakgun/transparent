import supabase from "@/lib/supabase/client";
import { createContext, useContext, useEffect, useState } from "react";

type Ledger = { id: string; name: string; description: string | null };

type LedgerProviderState = {
  ledgers: Ledger[];
  activeLedger: Ledger | undefined;
  selectLedger: (ledgerId: string) => void;
  refreshLedgers: () => Promise<Ledger[]>;
  loading: boolean;
};

const LedgerProviderContext = createContext<LedgerProviderState | undefined>(
  undefined,
);

const storageKeyFor = (userId: string) =>
  `transparent:active-ledger-id:${userId}`;

const readStoredLedgerId = (storageKey: string | undefined) => {
  if (!storageKey) return null;

  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};

const writeStoredLedgerId = (storageKey: string | undefined, id: string) => {
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, id);
  } catch {}
};

const fetchLedgers = async (): Promise<Ledger[]> => {
  const { data } = await supabase
    .from("active_ledgers")
    .select("id, name, description")
    .order("name");

  return data ?? [];
};

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [activeLedgerId, setActiveLedgerId] = useState<string>();
  const [storageKey, setStorageKey] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: sessionData }, ledgerData] = await Promise.all([
        supabase.auth.getSession(),
        fetchLedgers(),
      ]);

      const userId = sessionData.session?.user.id;
      const key = userId ? storageKeyFor(userId) : undefined;
      const storedId = readStoredLedgerId(key);

      setStorageKey(key);
      setLedgers(ledgerData);
      setActiveLedgerId(
        (ledgerData.find((ledger) => ledger.id === storedId) ?? ledgerData[0])
          ?.id,
      );
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!storageKey) return;

    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      if (!ledgers.some((ledger) => ledger.id === event.newValue)) return;

      setActiveLedgerId(event.newValue ?? undefined);
    };

    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey, ledgers]);

  const selectLedger = (ledgerId: string) => {
    setActiveLedgerId(ledgerId);
    writeStoredLedgerId(storageKey, ledgerId);
  };

  const refreshLedgers = async () => {
    const ledgerData = await fetchLedgers();

    setLedgers(ledgerData);
    setActiveLedgerId((current) =>
      ledgerData.some((ledger) => ledger.id === current)
        ? current
        : ledgerData[0]?.id,
    );

    return ledgerData;
  };

  const value = {
    ledgers,
    activeLedger: ledgers.find((ledger) => ledger.id === activeLedgerId),
    selectLedger,
    refreshLedgers,
    loading,
  };

  return (
    <LedgerProviderContext.Provider value={value}>
      {children}
    </LedgerProviderContext.Provider>
  );
}

export const useLedger = () => {
  const context = useContext(LedgerProviderContext);

  if (context === undefined)
    throw new Error("useLedger must be used within a LedgerProvider");

  return context;
};
