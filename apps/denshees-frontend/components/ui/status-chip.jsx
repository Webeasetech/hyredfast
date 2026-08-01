import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";

// Status colors are reserved — they signal state and are never reused as a
// generic accent. The shape/sizing comes from Chip so a chip change lands here.
const statusColors = {
  PENDING: "bg-yellow-50 text-yellow-800 border-yellow-300",
  FAILED: "bg-red-50 text-red-800 border-red-300",
  COMPLETED: "bg-green-50 text-green-800 border-green-300",
  PAUSED: "bg-gray-50 text-gray-800 border-gray-300",
  RUNNING: "bg-blue-50 text-blue-800 border-blue-300",
  PAUSING: "bg-purple-50 text-purple-800 border-purple-300",
  VERIFYING: "bg-indigo-50 text-indigo-800 border-indigo-300",
  REPLIED: "bg-emerald-50 text-emerald-800 border-emerald-300",
  BOUNCED: "bg-orange-50 text-orange-800 border-orange-300",
};

const statusLabels = {
  PENDING: "Pending",
  FAILED: "Failed",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  RUNNING: "Running",
  PAUSING: "Pausing",
  VERIFYING: "Verifying",
  REPLIED: "Replied",
  BOUNCED: "Bounced",
};

const StatusChip = ({ status, size = "md", icon, className }) => (
  <Chip
    size={size}
    icon={icon}
    className={cn(
      statusColors[status] || "bg-gray-50 text-gray-800 border-gray-300",
      className,
    )}
  >
    {statusLabels[status] || status}
  </Chip>
);

export default StatusChip;
