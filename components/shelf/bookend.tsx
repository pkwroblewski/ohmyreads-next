import { cn } from "@/lib/utils";
import s from "./shelf.module.css";

/** An L-shaped bookend; `left` faces right, holding books up from the left. */
export function Bookend({ side = "right" }: { side?: "left" | "right" }) {
  return (
    <div className={s.slot} aria-hidden="true">
      <span className={cn(s.bookend, side === "left" && s.left)} />
    </div>
  );
}
