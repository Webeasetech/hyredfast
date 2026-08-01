"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Mail,
  Search,
  Settings,
  Trash2,
  ChevronDown,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EChart } from "@/components/ui/echart";
import { Chip } from "@/components/ui/chip";

const TYPE_SCALE = [
  {
    name: "Display",
    cls: "text-5xl font-bold tracking-tight",
    size: "32/40",
    note: "Hero numbers, empty-state headlines. One per view.",
  },
  {
    name: "H1",
    cls: "text-3xl font-bold tracking-tight",
    size: "24/32",
    note: "Page title",
  },
  {
    name: "H2",
    cls: "text-2xl font-semibold tracking-tight",
    size: "20/28",
    note: "Section heading",
  },
  {
    name: "H3",
    cls: "text-xl font-semibold",
    size: "18/24",
    note: "Card / panel heading",
  },
  {
    name: "H4",
    cls: "text-lg font-semibold",
    size: "16/24",
    note: "Sub-heading, dialog title",
  },
  {
    name: "Body large",
    cls: "text-base",
    size: "14/20",
    note: "Intro copy, dialog description",
  },
  { name: "Body", cls: "text-sm", size: "13/18", note: "Default UI text" },
  {
    name: "Small",
    cls: "text-xs",
    size: "11/16",
    note: "Helper text, table meta",
  },
  {
    name: "Muted",
    cls: "text-sm text-muted-foreground",
    size: "13/18",
    note: "De-emphasised body",
  },
  {
    name: "Overline",
    cls: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
    size: "11/16",
    note: "Group label above a control",
  },
];

// Semantic tokens, not raw hex — everything reads from globals.css.
const SEMANTIC_TOKENS = [
  {
    name: "primary",
    cls: "bg-primary",
    fg: "text-primary-foreground",
    hex: "#0a66c2",
  },
  { name: "secondary", cls: "bg-secondary", fg: "text-secondary-foreground" },
  { name: "muted", cls: "bg-muted", fg: "text-muted-foreground" },
  { name: "accent", cls: "bg-accent", fg: "text-accent-foreground" },
  { name: "destructive", cls: "bg-destructive", fg: "text-white" },
  { name: "background", cls: "bg-background border", fg: "text-foreground" },
];

const CHART_SLOTS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

const BUTTON_VARIANTS = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
];
const BUTTON_SIZES = ["default", "sm", "lg", "icon"];
const BADGE_VARIANTS = ["default", "secondary", "destructive", "outline"];
const STATUS_CHIP_STATUSES = [
  "PENDING",
  "RUNNING",
  "PAUSING",
  "PAUSED",
  "VERIFYING",
  "COMPLETED",
  "REPLIED",
  "BOUNCED",
  "FAILED",
];

function Section({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border py-10">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div>
      {label && (
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "typography", label: "Typography" },
  { id: "color", label: "Color" },
  { id: "charts", label: "Charts" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs & Forms" },
  { id: "selection", label: "Selection Controls" },
  { id: "badges", label: "Chips & Badges" },
  { id: "table", label: "Table" },
  { id: "overlays", label: "Dialogs & Overlays" },
  { id: "menus", label: "Menus & Tooltips" },
  { id: "pagination", label: "Pagination" },
  { id: "calendar", label: "Calendar" },
  { id: "scroll-area", label: "Scroll Area" },
  { id: "toast", label: "Toast" },
];

const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];

// Two series -> legend is present, and the last point is directly labelled so
// identity never rests on color alone.
const LINE_OPTION = {
  legend: { data: ["Opens", "Replies"] },
  tooltip: { trigger: "axis" },
  // Endpoint labels sit outside the plot, so the right gutter has to make room
  // for them — otherwise ECharts clips them at the canvas edge.
  grid: { right: 56 },
  xAxis: { type: "category", boundaryGap: false, data: WEEKS },
  yAxis: { type: "value" },
  series: [
    {
      name: "Opens",
      type: "line",
      smooth: true,
      symbolSize: 8,
      lineStyle: { width: 2, cap: "round", join: "round" },
      areaStyle: { opacity: 0.1 },
      data: [820, 932, 901, 1290, 1330, 1520],
      endLabel: { show: true, formatter: "{c}", fontSize: 11 },
    },
    {
      name: "Replies",
      type: "line",
      smooth: true,
      symbolSize: 8,
      lineStyle: { width: 2, cap: "round", join: "round" },
      data: [120, 182, 191, 234, 290, 330],
      endLabel: { show: true, formatter: "{c}", fontSize: 11 },
    },
  ],
};

// Single series -> no legend box (the heading already names it). Bars are capped
// at 24px with a 4px rounded cap and square base, values on the cap.
const BAR_OPTION = {
  tooltip: { trigger: "item" },
  xAxis: {
    type: "category",
    data: [
      "Q3 Outreach",
      "Founder Intro",
      "Re-engage",
      "Win-back",
      "Newsletter",
    ],
  },
  yAxis: { type: "value" },
  series: [
    {
      type: "bar",
      barMaxWidth: 24,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: "top", fontSize: 11 },
      data: [128, 42, 310, 96, 214],
    },
  ],
};

export default function DesignSystemPage() {
  const [sliderValue, setSliderValue] = useState([40]);

  return (
    <TooltipProvider>
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-10">
        <aside className="sticky top-10 hidden h-fit w-48 shrink-0 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Foundations &amp; components
          </p>
          <nav className="flex flex-col gap-1 text-sm">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Design System</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Minimal surfaces, restrained neutrals, and a single primary
              (&#8203;<span className="font-medium text-primary">#0a66c2</span>)
              carrying emphasis. Every primitive below is the real component, so
              this page is both the spec and the smoke test.
            </p>
          </header>

          <Section
            id="typography"
            title="Typography"
            description="Host Grotesk throughout &mdash; one family, weight and size carry the hierarchy. The scale is set on Tailwind's own --text-* tokens, so these class names resolve to a denser scale app-wide."
          >
            <div className="flex flex-col divide-y divide-border">
              {TYPE_SCALE.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <div className="w-full shrink-0 sm:w-56">
                    <div className="text-xs font-medium text-foreground">
                      {t.name}
                    </div>
                    <code className="text-[11px] leading-relaxed text-muted-foreground">
                      {t.cls}
                    </code>
                    {t.size && (
                      <div className="text-[11px] tabular-nums text-muted-foreground">
                        {t.size} px
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={t.cls}>The quick brown fox</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {t.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="color"
            title="Color"
            description="Semantic tokens only &mdash; components never hardcode hex, so a token change repaints the app."
          >
            <Row label="semantic">
              {SEMANTIC_TOKENS.map((c) => (
                <div key={c.name} className="w-36">
                  <div
                    className={cn(
                      "flex h-16 items-end rounded-md p-2",
                      c.cls,
                      c.fg,
                    )}
                  >
                    <span className="text-xs font-medium">{c.name}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {c.hex ?? `--${c.name}`}
                  </div>
                </div>
              ))}
            </Row>
            <Row label="chart series (fixed order, never cycled)">
              {CHART_SLOTS.map((slot, i) => (
                <div key={slot} className="w-24">
                  <div
                    className="h-12 rounded-md"
                    style={{ backgroundColor: `hsl(var(--${slot}))` }}
                  />
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {i + 1}. --{slot}
                  </div>
                </div>
              ))}
            </Row>
            <p className="text-xs text-muted-foreground">
              Validated on the white chart surface: worst adjacent colour-blind
              &Delta;E 9.1, worst normal-vision &Delta;E 19.6. Slots 3&ndash;5
              fall below 3:1 contrast, so charts using them ship direct labels
              or a table view rather than relying on hue.
            </p>
          </Section>

          <Section
            id="charts"
            title="Charts"
            description="Apache ECharts via components/ui/echart.jsx &mdash; one wrapper reads the tokens above, so charts inherit the theme."
          >
            <div>
              <h3 className="text-sm font-medium">
                Opens &amp; replies over time
              </h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Two series &rarr; legend present, endpoints directly labelled.
              </p>
              <EChart option={LINE_OPTION} className="h-72" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Leads per campaign</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Single series &rarr; no legend box; the heading names it.
              </p>
              <EChart option={BAR_OPTION} className="h-72" />
            </div>
          </Section>

          <Section
            id="buttons"
            title="Button"
            description="components/ui/button.jsx &mdash; 37 usages"
          >
            {BUTTON_VARIANTS.map((variant) => (
              <Row key={variant} label={variant}>
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    {size === "icon" ? <Plus /> : `${variant} / ${size}`}
                  </Button>
                ))}
                <Button variant={variant} disabled>
                  disabled
                </Button>
              </Row>
            ))}
          </Section>

          <Section
            id="inputs"
            title="Input, Label & Textarea"
            description="input.jsx (17), label.jsx (12), textarea.jsx (4)"
          >
            <Row>
              <div className="w-64 space-y-1.5">
                <Label htmlFor="ds-email">Email</Label>
                <Input id="ds-email" placeholder="you@example.com" />
              </div>
              <div className="w-64 space-y-1.5">
                <Label htmlFor="ds-disabled">Disabled</Label>
                <Input id="ds-disabled" placeholder="Disabled" disabled />
              </div>
            </Row>
            <Row label="textarea">
              <Textarea
                className="w-96"
                placeholder="Write a message..."
                rows={3}
              />
            </Row>
            <Row label="rich-text-editor">
              <RichTextEditor
                className="h-48 w-full max-w-xl"
                variables={["name", "email"]}
                content="<p>Hi {{name}}, quick question about {{comapny}} — mistyped variables are flagged.</p>"
                placeholder="Start typing your email content..."
              />
            </Row>
          </Section>

          <Section
            id="selection"
            title="Selection Controls"
            description="select.jsx (4), checkbox.jsx (4), switch.jsx (1), toggle.jsx (1), slider.jsx (1)"
          >
            <Row label="select">
              <Select defaultValue="running">
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="checkbox">
              <div className="flex items-center gap-2">
                <Checkbox id="ds-cb1" />
                <Label htmlFor="ds-cb1">Unchecked</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-cb2" defaultChecked />
                <Label htmlFor="ds-cb2">Checked</Label>
              </div>
            </Row>
            <Row label="switch">
              <Switch id="ds-switch" />
              <Switch id="ds-switch-on" defaultChecked />
            </Row>
            <Row label="toggle">
              <Toggle aria-label="Toggle">Off</Toggle>
              <Toggle aria-label="Toggle" defaultPressed>
                On
              </Toggle>
              <Toggle variant="outline" aria-label="Toggle outline">
                Outline
              </Toggle>
            </Row>
            <Row label="slider">
              <Slider
                className="w-64"
                value={sliderValue}
                onValueChange={setSliderValue}
                max={100}
                step={1}
              />
              <span className="text-sm text-muted-foreground">
                {sliderValue[0]}
              </span>
            </Row>
          </Section>

          <Section
            id="badges"
            title="Chips, Badges & Status"
            description="chip.jsx is the base token; status-chip.jsx layers reserved status colours on top of it."
          >
            <Row label="chip — sizes">
              {["sm", "md", "lg"].map((size) => (
                <Chip key={size} size={size}>
                  {size}
                </Chip>
              ))}
            </Row>
            <Row label="chip — variants">
              <Chip>default</Chip>
              <Chip variant="primary">primary</Chip>
              <Chip variant="muted">muted</Chip>
            </Row>
            <Row label="chip — with logo compartment">
              {["sm", "md", "lg"].map((size) => (
                <Chip key={size} size={size} icon={<Mail />}>
                  Email
                </Chip>
              ))}
              <Chip variant="primary" icon={<Search />}>
                Enrichment
              </Chip>
            </Row>
            <Row label="badge">
              {BADGE_VARIANTS.map((variant) => (
                <Badge key={variant} variant={variant}>
                  {variant}
                </Badge>
              ))}
            </Row>
            <Row label="status-chip (built on chip)">
              {STATUS_CHIP_STATUSES.map((status) => (
                <StatusChip key={status} status={status} />
              ))}
            </Row>
          </Section>

          <Section
            id="table"
            title="Table"
            description="table.jsx &mdash; 3 usages"
          >
            <Table>
              <TableCaption>A list of recent campaigns.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Q3 Outreach", "RUNNING", 128],
                  ["Founder Intro", "PAUSED", 42],
                  ["Re-engagement", "COMPLETED", 310],
                ].map(([name, status, leads]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>
                      <StatusChip status={status} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">{leads}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section
            id="overlays"
            title="Dialogs & Overlays"
            description="dialog.jsx (11), alert-dialog.jsx (2), sheet.jsx (1), popover.jsx (1)"
          >
            <Row label="dialog">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit campaign</DialogTitle>
                    <DialogDescription>
                      Make changes to your campaign here.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-1.5">
                    <Label htmlFor="ds-dialog-name">Name</Label>
                    <Input id="ds-dialog-name" defaultValue="Q3 Outreach" />
                  </div>
                  <DialogFooter>
                    <Button>Save changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Row>
            <Row label="alert dialog">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-1" /> Delete campaign
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the campaign.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Row>
            <Row label="sheet">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Lead details</SheetTitle>
                    <SheetDescription>
                      View and edit lead information.
                    </SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </Row>
            <Row label="popover">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Settings className="mr-1" /> Settings
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="text-sm">Popover content goes here.</p>
                </PopoverContent>
              </Popover>
            </Row>
          </Section>

          <Section
            id="menus"
            title="Menus & Tooltips"
            description="dropdown-menu.jsx (3), tooltip.jsx (7)"
          >
            <Row label="dropdown menu">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Actions <ChevronDown className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Campaign</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Mail className="mr-2 h-4 w-4" /> Send test email
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Search className="mr-2 h-4 w-4" /> View leads
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Row>
            <Row label="tooltip">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip</p>
                </TooltipContent>
              </Tooltip>
            </Row>
          </Section>

          <Section
            id="pagination"
            title="Pagination"
            description="pagination.jsx &mdash; 1 usage"
          >
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    2
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">3</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </Section>

          <Section
            id="calendar"
            title="Calendar"
            description="calendar.jsx &mdash; 1 usage"
          >
            <div className="w-fit rounded-md border border-border">
              <Calendar mode="single" />
            </div>
          </Section>

          <Section
            id="scroll-area"
            title="Scroll Area"
            description="scroll-area.jsx &mdash; 1 usage"
          >
            <ScrollArea className="h-40 w-64 rounded-md border border-border p-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  Scrollable row {i + 1}
                </p>
              ))}
            </ScrollArea>
          </Section>

          <Section
            id="toast"
            title="Toast"
            description="sonner.jsx (mounted in app/layout.js) &mdash; toast() calls throughout the app"
          >
            <Row>
              <Button variant="outline" onClick={() => toast("Default toast")}>
                Default
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.success("Saved successfully")}
              >
                Success
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.error("Something went wrong")}
              >
                Error
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast("Undo delete?", {
                    action: { label: "Undo", onClick: () => {} },
                  })
                }
              >
                With action
              </Button>
            </Row>
          </Section>
        </main>
      </div>
    </TooltipProvider>
  );
}
