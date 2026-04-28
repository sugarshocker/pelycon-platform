import type { PSATicketStatus } from "@shared/types/psa";

const STAGES: { key: PSATicketStatus; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "working", label: "Working on it" },
  { key: "waiting", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
];

// waiting_client maps to the "waiting" stage position but with special styling
const STATUS_POSITION: Record<PSATicketStatus, number> = {
  received: 0,
  working: 1,
  waiting: 2,
  waiting_client: 2,
  resolved: 3,
};

interface Props {
  status: PSATicketStatus;
  compact?: boolean;
  mini?: boolean;
}

export function PizzaTracker({ status, compact = false, mini = false }: Props) {
  const currentPos = STATUS_POSITION[status];
  const isWaitingClient = status === "waiting_client";

  if (mini) {
    const fillPct = currentPos === 0 ? 0 : currentPos === 1 ? 33 : currentPos === 2 ? 66 : 100;
    const dotColor = isWaitingClient ? "bg-amber-500 border-amber-500" : "bg-[#E77125] border-[#E77125]";
    const lineColor = isWaitingClient ? "bg-amber-500" : "bg-[#E77125]";
    const label = isWaitingClient ? "Needs your reply" :
      status === "received" ? "Received" :
      status === "working" ? "Working on it" :
      status === "waiting" ? "Waiting" :
      "Resolved";

    return (
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="relative flex items-center w-[120px] h-3">
          <div className="absolute left-1.5 right-1.5 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200 dark:bg-gray-700">
            <div className={`h-full ${lineColor} transition-all duration-500`} style={{ width: `${fillPct}%` }} />
          </div>
          {STAGES.map((stage, i) => {
            const isFilled = i <= currentPos;
            return (
              <div key={stage.key} className="relative z-10 flex-1 flex justify-center">
                <div className={`h-3 w-3 rounded-full border-2 ${isFilled ? dotColor : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"}`} />
              </div>
            );
          })}
        </div>
        <span className={`text-[10px] font-medium ${isWaitingClient ? "text-amber-700" : "text-muted-foreground"}`}>{label}</span>
      </div>
    );
  }

  if (compact) {
    const label = isWaitingClient ? "Needs your reply" :
      status === "received" ? "Received" :
      status === "working" ? "In progress" :
      status === "waiting" ? "On hold" :
      "Resolved";

    const color = isWaitingClient
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : status === "resolved"
      ? "bg-green-100 text-green-700 border-green-200"
      : status === "received"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-orange-100 text-orange-700 border-orange-200";

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${color} whitespace-nowrap flex-shrink-0`}>
        {label}
      </span>
    );
  }

  return (
    <div className="w-full">
      {isWaitingClient && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <span className="text-amber-600 font-bold text-sm">!</span>
          <div>
            <div className="text-sm font-semibold text-amber-800">We need something from you</div>
            <div className="text-xs text-amber-700 mt-0.5">Please reply or provide the requested information to continue.</div>
          </div>
        </div>
      )}

      <div className="relative flex items-center justify-between">
        {/* Connecting line */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200">
          <div
            className="h-full bg-[#E77125] transition-all duration-500"
            style={{ width: currentPos === 0 ? "0%" : currentPos === 1 ? "33%" : currentPos === 2 ? "66%" : "100%" }}
          />
        </div>

        {STAGES.map((stage, i) => {
          const isDone = i < currentPos;
          const isCurrent = i === currentPos;
          return (
            <div key={stage.key} className="relative flex flex-col items-center gap-2 z-10">
              <div
                className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone
                    ? "bg-[#E77125] border-[#E77125] text-white"
                    : isCurrent
                    ? isWaitingClient && i === 2
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-[#E77125] border-[#E77125] text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-medium text-center max-w-[70px] ${isCurrent ? "text-[#394442] dark:text-white" : "text-muted-foreground"}`}>
                {isCurrent && isWaitingClient && i === 2 ? "Needs Your Reply" : stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
