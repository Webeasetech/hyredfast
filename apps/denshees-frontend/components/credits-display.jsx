"use client";
import { BuildingAIcon, ExclamationTriangleIcon } from "mage-icons-react/bulk";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
            <div
              className={`flex items-center gap-1 px-2 py-1 border text-xs font-mono font-medium ${
                isLow
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-black bg-white text-black"
              }`}
            >
              <BuildingAIcon className="h-3 w-3" />
              {remaining.toLocaleString("en-IN")}
            </div>
          </TooltipTrigger>
          <TooltipContent className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p>Companies remaining</p>
          </TooltipContent>
        </Tooltip>

        {isLow && (
          <Tooltip>
            <TooltipTrigger asChild>
              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />
            </TooltipTrigger>
            <TooltipContent className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] max-w-64">
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
