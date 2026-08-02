"use client";
import { BuildingAIcon, ExclamationTriangleIcon } from "mage-icons-react/bulk";
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
 * Companies remaining — the billing unit users actually buy.
 *
 * This used to show two "credit" chips. Credits still exist as internal
 * metering for the send pipeline, but they are not what anyone purchases and
 * showing them made the balance unreadable.
 */
export function CreditsDisplay({ user }) {
  const remaining = Math.max(
    0,
    (user?.companiesTotal || 0) - (user?.companiesUsed || 0),
  );
  const isLow = remaining < 5;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Chip
              size="sm"
              icon={<BuildingAIcon />}
              className={isLow ? LOW : undefined}
            >
              <span className="tabular-nums">
                {remaining.toLocaleString("en-IN")}
              </span>
            </Chip>
          </TooltipTrigger>
          <TooltipContent>
            <p>Companies remaining</p>
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
                  ? "No companies left."
                  : `${remaining} companies left.`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
