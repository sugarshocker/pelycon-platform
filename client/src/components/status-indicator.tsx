import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  value: number;
  thresholds?: { good: number; warning: number };
  label: string;
  suffix?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusIndicator({
  value,
  thresholds = { good: 90, warning: 80 },
  label,
  suffix = "%",
  size = "md",
}: StatusIndicatorProps) {
  const status =
    value >= thresholds.good
      ? "good"
      : value >= thresholds.warning
        ? "warning"
        : "action";

  const colorClasses = {
    good: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    action: "text-red-600 dark:text-red-400",
  };

  const bgClasses = {
    good: "bg-emerald-50 dark:bg-emerald-950/30",
    warning: "bg-amber-50 dark:bg-amber-950/30",
    action: "bg-red-50 dark:bg-red-950/30",
  };

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-md p-3",
        bgClasses[status]
      )}
    >
      <span className={cn("font-bold", sizeClasses[size], colorClasses[status])}>
        {Math.round(value)}
        {suffix}
      </span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

interface StatusDotProps {
  status: "good" | "warning" | "action";
  label?: string;
}

export function StatusDot({ status, label }: StatusDotProps) {
  const dotColors = {
    good: "bg-emerald-500",
    warning: "bg-amber-500",
    action: "bg-red-500",
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dotColors[status])} />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function TrendIndicator({
  direction,
}: {
  direction: "better" | "worse" | "stable" | null;
}) {
  if (!direction) return null;

  const config = {
    better: {
      label: "Improving",
      color: "text-emerald-600 dark:text-emerald-400",
      icon: "↑",
    },
    worse: {
      label: "Needs attention",
      color: "text-red-600 dark:text-red-400",
      icon: "↓",
    },
    stable: {
      label: "Stable",
      color: "text-muted-foreground",
      icon: "→",
    },
  };

  const c = config[direction];
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", c.color)}>
      <span>{c.icon}</span>
      {c.label}
    </span>
  );
}
