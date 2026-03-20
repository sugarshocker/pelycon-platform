import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  HelpCircle,
  TrendingUp,
  Building2,
  Receipt,
  LayoutDashboard,
  FilePen,
  ClipboardList,
  Users,
  BookOpen,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Shield,
  DollarSign,
  Calendar,
  Mail,
  AlertTriangle,
  Star,
  Clock,
  FileText,
  Activity,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SectionHeader({ icon: Icon, title, color = "text-primary" }: { icon: any; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={cn("h-5 w-5", color)} />
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function DefinitionRow({ term, children, mono = false }: { term: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-3 py-2.5 border-b last:border-0">
      <div className={cn("w-36 shrink-0 text-sm font-medium text-foreground/80", mono && "font-mono text-xs pt-0.5")}>
        {term}
      </div>
      <div className="flex-1 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 mt-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-muted-foreground">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="leading-relaxed">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({ icon: Icon = Lightbulb, children, variant = "info" }: { icon?: any; children: React.ReactNode; variant?: "info" | "warning" }) {
  return (
    <div className={cn(
      "flex gap-2.5 rounded-md p-3 text-sm leading-relaxed mt-3",
      variant === "info" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
    )}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function BadgeLegend({ items }: { items: { label: string; className: string; description: string }[] }) {
  return (
    <div className="grid gap-2 mt-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold shrink-0 min-w-[5rem] justify-center", item.className)}>
            {item.label}
          </span>
          <span className="text-sm text-muted-foreground">{item.description}</span>
        </div>
      ))}
    </div>
  );
}

const SECTIONS = [
  {
    id: "overview",
    label: "Platform Overview",
    icon: BookOpen,
    keywords: ["overview", "navigation", "sections", "what is", "intro"],
  },
  {
    id: "sales",
    label: "Sales Pipeline",
    icon: TrendingUp,
    keywords: ["sales", "quotes", "quoter", "awaiting", "pipeline", "won", "expired", "draft", "published"],
  },
  {
    id: "clients",
    label: "Client Management",
    icon: Building2,
    keywords: ["clients", "tier", "stack", "compliance", "ninja", "huntress", "edr", "itdr", "sat", "dropsuite", "zorus", "business premium", "ms bp", "connectsecure", "siem", "tbr status", "ar score"],
  },
  {
    id: "receivables",
    label: "Receivables & AR",
    icon: Receipt,
    keywords: ["receivables", "ar", "aging", "overdue", "payment", "invoice", "managed", "hourly", "score"],
  },
  {
    id: "tbr-tracker",
    label: "TBR Tracker",
    icon: LayoutDashboard,
    keywords: ["tbr", "tracker", "schedule", "frequency", "reminder", "lead engineer", "overdue", "never"],
  },
  {
    id: "tbr-reviews",
    label: "TBR Reviews & Staging",
    icon: FilePen,
    keywords: ["review", "staging", "tbr review", "device", "security", "ticket", "roadmap", "export", "meeting"],
  },
  {
    id: "admin",
    label: "Admin & User Management",
    icon: Users,
    keywords: ["admin", "user", "access", "role", "permission", "page access"],
  },
  {
    id: "howto",
    label: "How-To Guides",
    icon: Lightbulb,
    keywords: ["how to", "guide", "step", "set up", "create", "add", "sync"],
  },
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<string[]>(["overview"]);

  const filtered = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.keywords.some(k => k.includes(q))
    );
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Help & Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Everything you need to know to operate the Pelycon Executive Management Platform. Use search or browse by section.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search the knowledge base…"
          className="pl-9"
          data-testid="input-help-search"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No results found for <strong>"{search}"</strong>. Try a different term.
        </div>
      )}

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >

        {/* ── OVERVIEW ── */}
        {filtered.some(s => s.id === "overview") && (
          <AccordionItem value="overview" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-overview">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <BookOpen className="h-4 w-4 text-primary" /> Platform Overview
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                The <strong>Pelycon Executive Management Platform</strong> is an internal tool for Pelycon Technologies staff to manage clients, track sales activity, monitor accounts receivable, and run structured Technology Business Reviews (TBRs). All data is pulled live from ConnectWise, NinjaOne, Huntress, DropSuite, CIPP, and Quoter.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                {[
                  { icon: TrendingUp, label: "Sales Pipeline", desc: "Track outstanding quotes and won revenue from Quoter." },
                  { icon: Building2, label: "Client Management", desc: "Managed client list with tier, financials, stack compliance, and TBR status." },
                  { icon: Receipt, label: "Receivables", desc: "Accounts receivable aging, payment scores, and invoice detail for all clients." },
                  { icon: LayoutDashboard, label: "TBR Tracker", desc: "Schedule and track Technology Business Reviews for each managed client." },
                  { icon: FilePen, label: "TBR Reviews", desc: "Run a live TBR session — device health, security, tickets, and AI roadmap." },
                  { icon: ClipboardList, label: "TBR Staging", desc: "Pre-stage TBR content before a review meeting." },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex gap-3 rounded-md border p-3">
                    <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Callout>
                Navigation is on the left sidebar, organized into <strong>Sales</strong>, <strong>Clients</strong>, <strong>Operations</strong>, and <strong>Admin</strong> groups. Admins can control which sections each user can access.
              </Callout>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── SALES PIPELINE ── */}
        {filtered.some(s => s.id === "sales") && (
          <AccordionItem value="sales" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-sales">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <TrendingUp className="h-4 w-4 text-primary" /> Sales Pipeline
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Sales Pipeline pulls live data from <strong>Quoter</strong> — Pelycon's quoting platform. Quotes are automatically categorized into two buckets based on their current status and age.
              </p>

              <div>
                <h3 className="text-sm font-semibold mb-2">The Two Buckets</h3>
                <div className="space-y-3">
                  <div className="rounded-md border p-3 bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="font-semibold text-sm text-blue-700 dark:text-blue-400 mb-1">Awaiting Decision</div>
                    <p className="text-sm text-muted-foreground">Quotes that have been emailed to the client and are still within their expiry date. The client has received the quote but hasn't accepted or declined yet.</p>
                  </div>
                  <div className="rounded-md border p-3 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-1">Needs Follow-Up</div>
                    <p className="text-sm text-muted-foreground">Quotes that have recently expired (within 60 days) or are still in Draft. These need action — either follow up with the client, revise and resend, or mark as lost.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Quote Stage Legend</h3>
                <BadgeLegend items={[
                  { label: "Sent - Clicked", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", description: "Client received the email and clicked the quote link — highest engagement." },
                  { label: "Sent - Opened", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", description: "Client received and opened the email but hasn't clicked into the quote yet." },
                  { label: "Sent - Delivered", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", description: "Email was delivered to the client's inbox. No open tracking yet." },
                  { label: "Published", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", description: "Quote is finalized but hasn't been emailed to the client yet. It exists in Quoter but the client hasn't seen it." },
                  { label: "Draft", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", description: "Quote is still being built. Not sent to the client." },
                  { label: "Expired", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "Quote has passed its expiry date without a decision. Needs follow-up." },
                  { label: "Won - Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Client accepted the quote. Counted in 'Revenue Won This Month' if closed in the current month." },
                  { label: "Lost", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "Quote was declined or marked lost." },
                ]} />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Summary Stats</h3>
                <div className="space-y-0">
                  <DefinitionRow term="Quotes Created">New quotes started in Quoter during the current calendar month.</DefinitionRow>
                  <DefinitionRow term="Revenue Won">Total dollar value of quotes moved to Won status this calendar month.</DefinitionRow>
                  <DefinitionRow term="Awaiting Value">Combined dollar value of all quotes currently in the Awaiting Decision bucket.</DefinitionRow>
                  <DefinitionRow term="Needs Follow-Up Value">Combined dollar value of all quotes in the Needs Follow-Up bucket.</DefinitionRow>
                </div>
              </div>

              <Callout>
                When the same quote is sent to multiple contacts at a client, Quoter creates one record per contact. The platform automatically deduplicates these so each quote is counted once.
              </Callout>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── CLIENT MANAGEMENT ── */}
        {filtered.some(s => s.id === "clients") && (
          <AccordionItem value="clients" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-clients">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Building2 className="h-4 w-4 text-primary" /> Client Management
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Clients page shows all managed clients synced from ConnectWise. It has two tabs: <strong>Client List</strong> (overview table) and <strong>Stack Compliance</strong> (tool coverage per client). Click any client row to open a detail side panel.
              </p>

              <Tabs defaultValue="list" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="list">Client List</TabsTrigger>
                  <TabsTrigger value="stack">Stack Compliance</TabsTrigger>
                  <TabsTrigger value="panel">Side Panel</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Client Tier</h3>
                    <BadgeLegend items={[
                      { label: "Tier A", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-300 dark:border-purple-800", description: "Strategic accounts — highest revenue, highest relationship investment." },
                      { label: "Tier B", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-300 dark:border-blue-800", description: "Important accounts — solid revenue, regular TBR cadence." },
                      { label: "Tier C", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-300 dark:border-slate-700", description: "Standard accounts — managed clients with lower revenue or less engagement." },
                    ]} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">TBR Status</h3>
                    <BadgeLegend items={[
                      { label: "On Track", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Last TBR was within the scheduled frequency window. No action needed." },
                      { label: "Scheduled", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", description: "A TBR is scheduled for this client in the near future." },
                      { label: "Overdue", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", description: "The client's TBR is past due based on their frequency setting but has been done at least once." },
                      { label: "Never", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "No TBR has ever been completed for this client — highest priority to address." },
                    ]} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">AR Score</h3>
                    <p className="text-xs text-muted-foreground mb-2">Based on payment behavior pulled from ConnectWise — how reliably and quickly a client pays their invoices.</p>
                    <BadgeLegend items={[
                      { label: "A", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Excellent payer. Consistently on time, low or no overdue balance." },
                      { label: "B", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", description: "Good payer. Mostly on time with minor delays." },
                      { label: "C", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", description: "Fair payer. Some late payments or overdue balance." },
                      { label: "D", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "Poor payer. Frequently late, significant overdue balance." },
                    ]} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Other Columns</h3>
                    <div className="space-y-0">
                      <DefinitionRow term="Annual Revenue">Total annual recurring revenue from ConnectWise agreements for this client.</DefinitionRow>
                      <DefinitionRow term="GM %">Gross margin percentage — revenue minus direct costs, as a percent of revenue.</DefinitionRow>
                      <DefinitionRow term="Secure Score">Microsoft Secure Score from CIPP — a 0–100 measure of the client's Microsoft 365 security posture. Higher is better.</DefinitionRow>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stack" className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Stack Compliance shows whether each client has every required security and management tool deployed. Coverage % is calculated from required tools only.
                  </p>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">Tool Definitions</h3>
                    <div className="space-y-0">
                      <DefinitionRow term="Ninja RMM" mono>Remote Monitoring & Management. Used for device monitoring, patching, and remote access. <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="Huntress EDR" mono>Endpoint Detection & Response. Detects and responds to threats on managed devices. <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="Huntress ITDR" mono>Identity Threat Detection & Response. Monitors for identity-based attacks (e.g., credential compromise, Active Directory abuse). <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="Huntress SAT" mono>Security Awareness Training. Phishing simulations and training for end users. <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="DropSuite" mono>Cloud backup for Microsoft 365 (email, SharePoint, OneDrive). <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="Zorus DNS" mono>DNS filtering to block malicious sites and enforce web policies. <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="MS Bus. Premium" mono>Microsoft 365 Business Premium license — includes Defender, Intune, and advanced security features. <span className="text-primary font-medium">Required.</span></DefinitionRow>
                      <DefinitionRow term="ConnectSecure" mono>Vulnerability and compliance scanning for network devices and endpoints. <span className="text-muted-foreground">Optional.</span></DefinitionRow>
                      <DefinitionRow term="Huntress SIEM" mono>Security Information & Event Management. Aggregates and analyzes security logs. <span className="text-muted-foreground">Optional.</span></DefinitionRow>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Status Icons</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Tool is deployed and active for this client.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-muted-foreground">Required tool is <strong>missing</strong> — action needed.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MinusCircle className="h-4 w-4 text-muted-foreground/40" />
                        <span className="text-sm text-muted-foreground">Optional tool is not deployed (no penalty to coverage %).</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MinusCircle className="h-4 w-4 text-muted-foreground/30" />
                        <span className="text-sm text-muted-foreground">Status unknown — compliance data has not been synced yet.</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Coverage % Formula</h3>
                    <div className="rounded-md bg-muted/40 p-3 text-sm font-mono text-center">
                      Coverage % = (Required tools deployed ÷ Total required tools) × 100
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Only the 7 required tools count toward this percentage. Optional tools (ConnectSecure, Huntress SIEM) are tracked but not penalized if absent.</p>
                  </div>
                </TabsContent>

                <TabsContent value="panel" className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Clicking any client row opens a side panel with four tabs giving a full picture of that client.
                  </p>
                  <div className="space-y-3">
                    {[
                      { tab: "Overview", desc: "Key metrics: tier, annual revenue, gross margin, TBR status, AR score, Secure Score, and stack coverage percentage." },
                      { tab: "Financials", desc: "ConnectWise agreement breakdown — engineering hours, additions, analysis of billing vs. budget. Pulled live from ConnectWise." },
                      { tab: "TBR", desc: "Last completed TBR date, next scheduled date, frequency setting, and links to run a new review or view history." },
                      { tab: "Receivables", desc: "Outstanding balance, aging breakdown, payment score, and recent invoice list for this specific client." },
                    ].map(({ tab, desc }) => (
                      <div key={tab} className="flex gap-3 rounded-md border p-3">
                        <div className="w-24 text-sm font-semibold text-primary shrink-0">{tab}</div>
                        <div className="text-sm text-muted-foreground">{desc}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── RECEIVABLES ── */}
        {filtered.some(s => s.id === "receivables") && (
          <AccordionItem value="receivables" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-receivables">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Receipt className="h-4 w-4 text-primary" /> Receivables & AR
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Receivables page pulls accounts receivable data live from ConnectWise. It shows every client with an outstanding or recent invoice balance, along with payment behavior analysis.
              </p>

              <div>
                <h3 className="text-sm font-semibold mb-2">Client Types</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs shrink-0">Managed</Badge>
                    <span className="text-sm text-muted-foreground">Fully managed IT clients with a recurring managed services agreement — the core client base.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs shrink-0">Hourly</Badge>
                    <span className="text-sm text-muted-foreground">Clients with a ConnectWise agreement who pay hourly for support rather than a flat managed services fee.</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">AR Aging Buckets</h3>
                <p className="text-xs text-muted-foreground mb-3">The aging bar on each client shows how the outstanding balance is distributed across time since the invoice due date.</p>
                <div className="space-y-1">
                  {[
                    { label: "Current", color: "bg-green-500", desc: "Invoice is not yet past its due date." },
                    { label: "1–30 days", color: "bg-yellow-500", desc: "Overdue by up to 30 days — follow up recommended." },
                    { label: "31–60 days", color: "bg-orange-500", desc: "Overdue 31–60 days — escalate internally." },
                    { label: "61–90 days", color: "bg-red-400", desc: "Overdue 61–90 days — collections risk." },
                    { label: "91+ days", color: "bg-red-600", desc: "Overdue over 90 days — serious delinquency." },
                  ].map(({ label, color, desc }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={cn("w-3 h-3 rounded-sm shrink-0", color)} />
                      <span className="text-xs font-medium w-20 shrink-0">{label}</span>
                      <span className="text-sm text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Payment Score</h3>
                <p className="text-xs text-muted-foreground mb-2">Calculated from the last 18 months of invoice history. Combines average days to pay, on-time %, and current overdue balance.</p>
                <BadgeLegend items={[
                  { label: "A", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Excellent — pays on time consistently, minimal or no overdue balance." },
                  { label: "B", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", description: "Good — mostly on time, small overdue balance or occasional late payment." },
                  { label: "C", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", description: "Fair — regular late payments or notable overdue balance." },
                  { label: "D", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "Poor — frequent delinquency, large overdue balance." },
                ]} />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Summary Stats</h3>
                <div className="space-y-0">
                  <DefinitionRow term="Total Outstanding">Sum of all unpaid invoice balances across all clients.</DefinitionRow>
                  <DefinitionRow term="Total Overdue">Amount outstanding that is past its due date (any aging bucket beyond Current).</DefinitionRow>
                  <DefinitionRow term="Avg Days to Pay">Average number of days between invoice date and payment, calculated across all paid invoices in the last 18 months.</DefinitionRow>
                  <DefinitionRow term="On-Time %">Percentage of paid invoices in the last 18 months that were paid by their due date.</DefinitionRow>
                </div>
              </div>

              <Callout icon={AlertTriangle} variant="warning">
                The Receivables page shows all invoice types — including project invoices, time & material, and recurring agreements. Use the filter dropdown to narrow by client type.
              </Callout>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── TBR TRACKER ── */}
        {filtered.some(s => s.id === "tbr-tracker") && (
          <AccordionItem value="tbr-tracker" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-tbr-tracker">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <LayoutDashboard className="h-4 w-4 text-primary" /> TBR Tracker
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The TBR Tracker is the home page. It gives a dashboard view of all TBR schedules — which clients are on track, which are overdue, and which have never had a review.
              </p>

              <div>
                <h3 className="text-sm font-semibold mb-2">TBR Status Definitions</h3>
                <BadgeLegend items={[
                  { label: "On Track", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Last TBR was completed within the client's scheduled frequency. Nothing to do." },
                  { label: "Scheduled", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", description: "A future TBR date has been set for this client." },
                  { label: "Overdue", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", description: "The client's review cycle has passed. A TBR has been done before but a new one is due." },
                  { label: "Never", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "No TBR has been completed for this client. Highest urgency." },
                ]} />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">TBR Schedule Fields</h3>
                <div className="space-y-0">
                  <DefinitionRow term="Frequency">How often a TBR should occur for this client — Monthly, Quarterly, Semi-Annual, or Annual.</DefinitionRow>
                  <DefinitionRow term="Next Review Date">The date the next TBR is planned. Can be set manually when scheduling ahead.</DefinitionRow>
                  <DefinitionRow term="Lead Engineer Email">An optional email address for the engineer who leads this client's TBRs. They receive a reminder email 3 days before the review date, in addition to the global reminders.</DefinitionRow>
                  <DefinitionRow term="Notes">Free-text notes about this client's TBR schedule — useful for context when reviewing the tracker.</DefinitionRow>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Reminder Emails</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Reminders are automatically sent <strong>3 days before</strong> a scheduled TBR date. There are two levels:</p>
                  <div className="rounded-md border p-3 space-y-1">
                    <div><span className="font-medium">Global reminders</span> — set in Settings on the TBR Tracker page. These go to the Service Manager and any other email you configure. They receive reminders for <em>every</em> client's TBR.</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div><span className="font-medium">Per-client Lead Engineer</span> — set on each schedule individually (edit the pencil icon). Only receives reminders for that specific client's TBR.</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Dashboard Charts</h3>
                <div className="space-y-0">
                  <DefinitionRow term="Monthly Chart">Shows how many TBRs were completed each month over the past 12 months.</DefinitionRow>
                  <DefinitionRow term="Weekly Chart">Zoomed-in view of TBR completions by week for the current quarter.</DefinitionRow>
                  <DefinitionRow term="Top Clients Needing TBR">Quick-access list of the highest-revenue clients who currently need a review, sorted by revenue to help prioritize.</DefinitionRow>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── TBR REVIEWS & STAGING ── */}
        {filtered.some(s => s.id === "tbr-reviews") && (
          <AccordionItem value="tbr-reviews" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-tbr-reviews">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <FilePen className="h-4 w-4 text-primary" /> TBR Reviews & Staging
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                There are two pages for running a TBR: <strong>TBR Staging</strong> (prep before the meeting) and <strong>TBR Reviews</strong> (the live review session itself).
              </p>

              <div>
                <h3 className="text-sm font-semibold mb-2">TBR Staging</h3>
                <p className="text-sm text-muted-foreground mb-2">Use Staging to prepare talking points before a client meeting. Fill in each section ahead of time so the review runs smoothly.</p>
                <div className="space-y-0">
                  <DefinitionRow term="Project Summary">Upcoming or in-flight projects to discuss with the client.</DefinitionRow>
                  <DefinitionRow term="Client Feedback">Notes on client satisfaction, recent wins, or concerns raised by the client.</DefinitionRow>
                  <DefinitionRow term="Internal Notes">Two sub-sections: Service Manager notes and Lead Engineer notes — internal only, not shown to clients.</DefinitionRow>
                  <DefinitionRow term="Security Section">Pre-stage key security talking points (threats, incidents, posture improvements).</DefinitionRow>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">TBR Reviews (Live Session)</h3>
                <p className="text-sm text-muted-foreground mb-2">The Reviews page pulls live data from connected platforms during the meeting. Select a client at the top to load their data.</p>
                <div className="space-y-0">
                  <DefinitionRow term="Device Health">Pulled from NinjaOne — shows offline devices, patch status, and disk health warnings.</DefinitionRow>
                  <DefinitionRow term="Security">Pulled from Huntress — active threats, incidents, and security summary for the client.</DefinitionRow>
                  <DefinitionRow term="Ticket Trends">Pulled from ConnectWise — ticket volume over time, by type and priority, to identify recurring issues.</DefinitionRow>
                  <DefinitionRow term="Project Summary">Staged project notes for discussion.</DefinitionRow>
                  <DefinitionRow term="AI Roadmap">AI-generated technology roadmap based on device health, security posture, and ticket trends. Provides recommended next steps.</DefinitionRow>
                  <DefinitionRow term="Meeting Export">Exports a formatted PDF or summary of the TBR for client-facing delivery or internal records.</DefinitionRow>
                  <DefinitionRow term="CIPP Reports">Microsoft 365 report data pulled via CIPP — license usage, security posture, and policy compliance for the client's Microsoft tenant.</DefinitionRow>
                </div>
              </div>

              <Callout>
                After completing a TBR review, click <strong>"Mark as Completed"</strong> to log the date and update the client's TBR status to "On Track" on the Tracker.
              </Callout>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── ADMIN ── */}
        {filtered.some(s => s.id === "admin") && (
          <AccordionItem value="admin" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-admin">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Users className="h-4 w-4 text-primary" /> Admin & User Management
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                User Management is only visible to Admin users. It controls who can log in and which sections they can access.
              </p>

              <div>
                <h3 className="text-sm font-semibold mb-2">User Roles</h3>
                <div className="space-y-0">
                  <DefinitionRow term="Admin">Full access to all pages and to User Management. Can create, edit, and delete users. Can change page access for other users.</DefinitionRow>
                  <DefinitionRow term="User">Standard access. Can see pages they've been given access to. Cannot manage other users or change permissions.</DefinitionRow>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Page Access Control</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Each non-admin user can be given or restricted access to individual pages. Toggle each page on or off per user in the User Management screen.
                </p>
                <div className="space-y-0">
                  <DefinitionRow term="Sales Pipeline">Access to the Quoter sales pipeline.</DefinitionRow>
                  <DefinitionRow term="Client Management">Access to the client list and stack compliance.</DefinitionRow>
                  <DefinitionRow term="Receivables">Access to AR aging and payment data.</DefinitionRow>
                  <DefinitionRow term="TBR Tracker">Access to the TBR schedule tracker (home page).</DefinitionRow>
                  <DefinitionRow term="TBR Reviews">Access to run live TBR review sessions.</DefinitionRow>
                  <DefinitionRow term="TBR Staging">Access to pre-stage TBR content.</DefinitionRow>
                </div>
              </div>

              <Callout icon={AlertTriangle} variant="warning">
                Admins always have full access to every page regardless of the page access settings. Only non-admin users are affected by page restrictions.
              </Callout>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── HOW-TO GUIDES ── */}
        {filtered.some(s => s.id === "howto") && (
          <AccordionItem value="howto" className="border rounded-lg px-5 shadow-sm" data-testid="help-section-howto">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Lightbulb className="h-4 w-4 text-primary" /> How-To Guides
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="grid sm:grid-cols-2 gap-6">

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary" /> Add or Edit a TBR Schedule</h3>
                  <StepList steps={[
                    "Go to TBR Tracker in the sidebar.",
                    "Find the client in the schedule table.",
                    "Click the pencil (edit) icon on their row. If they have no schedule yet, click 'Add Schedule' in the top-right.",
                    "Set the review frequency (Monthly, Quarterly, etc.) and optionally set a Next Review Date.",
                    "Optionally enter a Lead Engineer Email — they'll receive reminders 3 days before each TBR.",
                    "Click Save.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary" /> Set Up Global TBR Reminders</h3>
                  <StepList steps={[
                    "Go to TBR Tracker.",
                    "Click the 'Email Settings' button (top right area of the page).",
                    "Enter the Service Manager email and any additional recipient email.",
                    "Save — these addresses will receive reminders 3 days before every client TBR.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> Sync Clients from ConnectWise</h3>
                  <StepList steps={[
                    "Go to Client Management.",
                    "Click the 'Sync Clients' button in the top-right.",
                    "The system will pull all active managed-service clients from ConnectWise and update the local database.",
                    "New clients will appear; clients no longer in ConnectWise will be flagged.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" /> Update Stack Compliance for a Client</h3>
                  <StepList steps={[
                    "Go to Client Management → Stack Compliance tab.",
                    "Find the client row.",
                    "Click the edit icon to manually toggle each tool on or off.",
                    "Save — the coverage percentage will update automatically.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FilePen className="h-3.5 w-3.5 text-primary" /> Run a TBR Review</h3>
                  <StepList steps={[
                    "(Optional) Pre-stage content in TBR Staging — fill in projects, feedback, and notes ahead of the meeting.",
                    "Go to TBR Reviews.",
                    "Select the client from the dropdown or search box at the top.",
                    "Review each section: Device Health, Security, Ticket Trends, and the AI Roadmap.",
                    "Add or finalize internal notes.",
                    "When done, click 'Mark as Completed' to log the review and reset the TBR status to On Track.",
                    "(Optional) Use 'Export Meeting' to generate a client-ready summary.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Add a New User</h3>
                  <StepList steps={[
                    "Go to Admin → User Management (Admin only).",
                    "Click 'Add User' and enter their name, email, and a temporary password.",
                    "Set their role (Admin or User).",
                    "Toggle page access on/off for each section they should be able to see.",
                    "Save — the user can now log in with the credentials you set.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-primary" /> Read an AR Aging Bar</h3>
                  <StepList steps={[
                    "Go to Receivables and expand a client.",
                    "The colored bar represents the client's outstanding balance split by how overdue each portion is.",
                    "Green = current (not yet due). Yellow = 1–30 days late. Orange = 31–60 days. Dark red = 91+ days.",
                    "Hover over each segment to see the exact dollar amount in that aging bucket.",
                    "The Payment Score letter (A–D) summarizes overall payment behavior over 18 months.",
                  ]} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-primary" /> Understand a Quote's Status</h3>
                  <StepList steps={[
                    "Go to Sales Pipeline.",
                    "Awaiting Decision = the client has received the quote via email and the expiry date hasn't passed yet.",
                    "Needs Follow-Up = the quote expired recently (within 60 days) or is still a draft.",
                    "Check the stage badge on each quote: Sent-Clicked means the client engaged; Sent-Delivered means it arrived but may not have been opened.",
                    "Quotes shown in the Awaiting list are deduplicated — if the same quote was sent to multiple contacts, it's counted once.",
                  ]} />
                </div>

              </div>
            </AccordionContent>
          </AccordionItem>
        )}

      </Accordion>

      <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
        Pelycon Executive Management Platform — Internal Use Only
      </div>
    </div>
  );
}
