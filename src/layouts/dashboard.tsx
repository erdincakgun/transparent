import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Outlet, useLocation } from "react-router";

const pageNames: Record<string, string> = {
  "/": "Settle Up",
  "/transactions": "Transactions",
  "/accounts": "Accounts",
  "/users": "Users",
};

export default function Dashboard() {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      {/* 2.4.1: the sidebar and the header repeat on all four pages, and a
          keyboard reaches every one of their controls before the first row of
          the list. The link is `sr-only` until focused, which is the only way
          it can be reached — a pointer cannot click what it cannot see. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to main content
      </a>
      <AppSidebar />
      {/* `min-w-0`: SidebarInset is a flex item, so its default `min-width:
          auto` lets a long unbreakable account name set the layout's width —
          the page then scrolls sideways instead of the name truncating. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 cursor-pointer" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  {/* `BreadcrumbPage` is what carries `aria-current="page"`;
                      a bare item is just text. */}
                  <BreadcrumbPage>{pageNames[pathname]}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <ModeToggle></ModeToggle>
          </div>
        </header>
        {/* The skip link aims past the header too, not just the sidebar —
            the header repeats on all four pages as well. `tabIndex={-1}`
            because focus only moves to a target that can hold it; without
            it the next Tab would start from the top of the page again. */}
        <div
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col gap-4 p-4 pt-0 outline-none"
        >
          <Outlet></Outlet>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
