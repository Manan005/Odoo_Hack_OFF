import { cn } from "@/lib/utils"

/** `text` renders a line of copy: 0.9em tall, 4px corners — pair with a width. */
export function Skeleton({ className, text }: { className?: string; text?: boolean }) {
  return <div aria-hidden className={cn("skeleton", text ? "skeleton-text" : "rounded-lg", className)} />
}
