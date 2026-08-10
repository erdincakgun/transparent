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

export function LedgerSwitcher() {
  const { isMobile } = useSidebar();
  const [ledgers, setLedgers] = useState<{ id: string; name: string }[]>([]);

  const [activeLedger, setActiveLedger] = useState<{
    id: string;
    name: string;
  }>();

  useEffect(() => {
    const load = async () => {
      const { data: ledgerData } = await supabase
        .from("ledgers")
        .select("id, name")
        .order("name");

      setLedgers(ledgerData ?? []);
      setActiveLedger(ledgers[0]);
    };
    load();
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{activeLedger?.name}</span>
              <span className="truncate text-xs">{activeLedger?.id}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
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
                  onClick={() => setActiveLedger(ledger)}
                  className="gap-2 p-2"
                >
                  {ledger.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2 p-2">
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
