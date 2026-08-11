import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import supabase from "@/lib/supabase/client";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

export const ACTIVE_LEDGER_STORAGE_KEY = "transparent:active-ledger-id";

export function LedgerSwitcher() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  type Ledger = { id: string; name: string };

  const [ledgers, setLedgers] = useState<Ledger[]>([]);

  const [activeLedger, setActiveLedger] = useState<{
    id: string;
    name: string;
  }>();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("ledgers")
        .select("id, name")
        .order("name");

      const ledgerData = data ?? [];
      setLedgers(ledgerData);

      const storedId = localStorage.getItem(ACTIVE_LEDGER_STORAGE_KEY);

      setActiveLedger(
        ledgerData.find((ledger) => ledger.id === storedId) ?? ledgerData[0],
      );
    };
    load();
  }, []);

  const selectLedger = (ledger: Ledger) => {
    setActiveLedger(ledger);
    localStorage.setItem(ACTIVE_LEDGER_STORAGE_KEY, ledger.id);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground cursor-pointer"
              />
            }
          >
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{activeLedger?.name}</span>
              <span className="truncate text-xs">{activeLedger?.id}</span>
            </div>
            <ChevronsUpDownIcon className="mx-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Ledgers
              </DropdownMenuLabel>
              {ledgers.map((ledger, _) => (
                <DropdownMenuItem
                  key={ledger.name}
                  onClick={() => selectLedger(ledger)}
                  className="gap-2 p-2"
                >
                  {ledger.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => navigate("/ledger-create")}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add ledger
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
