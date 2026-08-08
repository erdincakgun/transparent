import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import {
  SparklesIcon,
  BadgeCheckIcon,
  CreditCardIcon,
  BellIcon,
  LogOutIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useNavigate } from "react-router";

export function NavUser({
  user,
}: {
  user: {
    email: string | undefined;
  };
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  const signOut = () => {
    supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <MoreHorizontalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
