import { LoaderIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export function SpinnerCustom() {
  return (
    <div className="flex items-center gap-4">
      <Spinner />
    </div>
  )
}

export function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <Spinner className="w-24 h-24 text-primary" />
    </div>
  )
}