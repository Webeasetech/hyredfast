"use client";
import { EmailIcon, ExclamationTriangleIcon } from "mage-icons-react/bulk";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Chip } from "@/components/ui/chip";

// Low balance is a warning state, so it gets its own colours rather than the
// chip's default surface.
const LOW = "border-red-300 bg-red-50 text-red-700";

/**
 * Emails left in the current term — the billing unit users actually buy.
 *
 * One credit is one email sent. Nothing refills: this is a lump bought up
 * front and spent down, so a low number means low until they top up or renew.
 */
export function CreditsDisplay({ user }) {
  const remaining = user?.balance?.remaining ?? 0;
  // 250 is roughly a week of steady sending, which is enough warning to act on.
  const isLow = remaining < 250;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Chip
              size="sm"
              icon={<EmailIcon />}
              className={isLow ? LOW : undefined}
            >
              <span className="tabular-nums">
                {remaining.toLocaleString("en-IN")}
              </span>
            </Chip>
          </TooltipTrigger>
          <TooltipContent>
            <p>Emails left</p>
          </TooltipContent>
        </Tooltip>

        {isLow && (
          <Tooltip>
            <TooltipTrigger asChild>
              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <p className="text-xs">
                {remaining === 0
                  ? "No emails left. Top up or renew to keep sending."
                  : `${remaining.toLocaleString("en-IN")} emails left in this term.`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
