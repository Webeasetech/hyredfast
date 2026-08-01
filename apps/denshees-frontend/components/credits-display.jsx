"use client";
import {
  CoinAIcon,
  StarsCIcon,
  ExclamationTriangleIcon,
} from "mage-icons-react/bulk";
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

export function CreditsDisplay({ user }) {
  const totalCredits = user?.credits || 0;
  const aiCredits = user?.aiCredits || 0;

  const isLowCredits = totalCredits < 20;
  const isLowAI = aiCredits < 20;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Chip
              size="sm"
              icon={<CoinAIcon />}
              className={isLowCredits ? LOW : undefined}
            >
              <span className="tabular-nums">
                {totalCredits.toLocaleString()}
              </span>
            </Chip>
          </TooltipTrigger>
          <TooltipContent>
            <p>Email Credits</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Chip
              size="sm"
              icon={<StarsCIcon />}
              className={isLowAI ? LOW : undefined}
            >
              <span className="tabular-nums">{aiCredits.toLocaleString()}</span>
            </Chip>
          </TooltipTrigger>
          <TooltipContent>
            <p>AI Credits</p>
          </TooltipContent>
        </Tooltip>

        {(isLowCredits || isLowAI) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <p className="text-xs">
                Credits running low.
                {isLowCredits && ` Email: ${totalCredits}`}
                {isLowCredits && isLowAI && ","}
                {isLowAI && ` AI: ${aiCredits}`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
