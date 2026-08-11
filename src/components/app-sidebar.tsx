import * as React from "react";
import { NavItems } from "@/components/nav-app";
import { NavUser } from "@/components/nav-user";
import { LedgerSwitcher } from "@/components/ledgers-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ArrowRightLeft, ReceiptText, Summary, Users } from "lucide-react";
import supabase from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const data = {
  navItems: [
    {
      name: "Summary",
      url: "/",
      icon: <Summary />,
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
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      setEmail(userData.user?.email);

      const { data: ledgerData } = await supabase.from("ledgers").select("id");

      if (!ledgerData?.length) {
        navigate("/ledger-create", { replace: true });
        return;
      }
    };
    load();
  }, [navigate]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LedgerSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavItems navItems={data.navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            email: email,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
