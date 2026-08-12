interface BadgeProps {
  status: "confirmed" | "completed" | "cancelled" | "no_show";
}

const statusStyles: Record<string, string> = {
  confirmed: "text-deep-brown bg-deep-brown/15",
  completed: "text-success bg-success/15",
  cancelled: "text-danger bg-danger/15",
  no_show: "text-muted bg-muted/15",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold font-sans ${statusStyles[status] || statusStyles.confirmed}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
