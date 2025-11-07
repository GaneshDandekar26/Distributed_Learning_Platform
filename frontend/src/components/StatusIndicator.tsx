import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  online: boolean;
  label?: string;
  className?: string;
}

export const StatusIndicator = ({ online, label, className }: StatusIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div
          className={cn(
            "h-3 w-3 rounded-full",
            online ? "bg-online" : "bg-offline"
          )}
        />
        {online && (
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-online animate-ping opacity-75" />
        )}
      </div>
      {label && (
        <span className="text-sm text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
};
