import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const InfoToolTip = ({ children, content }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="bg-white border border-border rounded-lg">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default InfoToolTip;
