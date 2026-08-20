import * as React from "react";
import { NavItems } from "@/components/nav-app";
import { NavUser } from "@/components/nav-user";
import { LedgerSwitcher } from "@/components/ledgers-switcher";
import { useLedger } from "@/components/ledger-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ArrowRightLeft, Handshake, ReceiptText, Users } from "lucide-react";
import supabase from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const data = {
  navItems: [
    {
      name: "Settle Up",
      url: "/",
      icon: <Handshake />,
    },
    {
      name: "Transactions",
      url: "/transactions",
      icon: <ArrowRightLeft />,
    },
    {
      name: "Accounts",
      url: "/accounts",
      icon: <ReceiptText />,
    },
    {
      name: "Users",
      url: "/users",
      icon: <Users />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const { ledgers, loading } = useLedger();
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      setEmail(userData.user?.email);
      setUserId(userData.user?.id);
    };
    load();
  }, []);

  useEffect(() => {
    if (loading || ledgers.length) return;

    navigate("/ledger-create", { replace: true });
  }, [loading, ledgers, navigate]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LedgerSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {/* The sidebar itself is a plain div, so without this the four page
            links are a list in no landmark at all — nothing for a screen
            reader's "go to navigation" to land on. */}
        <nav aria-label="Ledger pages">
          <NavItems navItems={data.navItems} />
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            id: userId,
            email: email,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
