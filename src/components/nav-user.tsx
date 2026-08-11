import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import supabase from "@/lib/supabase/client";
import { Copy, LogOutIcon, MoreHorizontalIcon } from "lucide-react";
import { useNavigate } from "react-router";

export function NavUser({
  user,
}: {
  user: {
    id: string | undefined;
    email: string | undefined;
  };
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  const copyUserId = () => {
    if (!user.id) return;

    navigator.clipboard.writeText(user.id);
  };

  const signOut = () => {
    supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="aria-expanded:bg-muted group-data-[collapsible=icon]:p-2! cursor-pointer"
              />
            }
          >
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
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
            <DropdownMenuItem onClick={copyUserId} disabled={!user.id}>
              <Copy />
              Copy user ID
            </DropdownMenuItem>
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
