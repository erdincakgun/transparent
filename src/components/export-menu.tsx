import {
  ChevronDownIcon,
  DownloadIcon,
  FileCodeIcon,
  TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ExportFormat = "csv" | "html";

export function ExportMenu({
  disabled,
  onExport,
}: {
  disabled?: boolean;
  onExport: (format: ExportFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button variant="outline" />}
      >
        <DownloadIcon />
        Export
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-fit" align="end">
        <DropdownMenuItem className="gap-2 p-2" onClick={() => onExport("csv")}>
          <TableIcon className="text-muted-foreground" />
          <div className="grid flex-1 text-left leading-tight">
            <span className="font-medium">CSV</span>
            <span className="text-xs text-muted-foreground">
              Raw columns, for a spreadsheet
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 p-2"
          onClick={() => onExport("html")}
        >
          <FileCodeIcon className="text-muted-foreground" />
          <div className="grid flex-1 text-left leading-tight">
            <span className="font-medium">HTML</span>
            <span className="text-xs text-muted-foreground">
              A readable page, to print or share
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
