"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { scheduleFit, tidyMonthLabels } from "./fit-spine-titles";
import s from "./shelf.module.css";

interface ShelfClientProps {
  /** The server-rendered shelf. */
  children: ReactNode;
  /** The same books as a table; omit to hide the Shelf/List toggle. */
  list?: ReactNode;
  label: string;
}

/**
 * Client half of the shelf: fits spine titles once fonts load, hides
 * colliding month labels, shows the pulled-out book in a detail bar, and
 * switches between the shelf and the list view.
 */
export function ShelfClient({ children, list, label }: ShelfClientProps) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"shelf" | "list">("shelf");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const root = shelfRef.current;
    if (!root || view !== "shelf") return;
    // Title sizes depend on the real fonts and on the shelf height, which
    // changes at the small-screen breakpoint. Fit only once the shelf is
    // near the viewport: off-screen shelves skip layout (content-visibility),
    // and measuring them would force it.
    let visible = false;
    let fitted = false;
    const settle = () => {
      if (visible) {
        fitted = true;
        scheduleFit(root);
      } else fitted = false;
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !fitted) settle();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(root);
    const mq = window.matchMedia("(max-width: 640px)");
    mq.addEventListener("change", settle);
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => visible && tidyMonthLabels(root), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      mq.removeEventListener("change", settle);
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [view]);

  const showFrom = (target: EventTarget | null) => {
    const spine = (target as HTMLElement | null)?.closest<HTMLElement>("[data-spine]");
    if (spine) setDetail(spine.dataset.detail ?? null);
  };

  return (
    <div className={s.client}>
      {list && (
        <div className={s.seg} role="group" aria-label={`${label}: view`}>
          <button type="button" aria-pressed={view === "shelf"} onClick={() => setView("shelf")}>
            Shelf
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
            List
          </button>
        </div>
      )}
      <div
        ref={shelfRef}
        hidden={view !== "shelf"}
        onPointerOver={(e) => showFrom(e.target)}
        onPointerLeave={() => setDetail(null)}
        onFocus={(e) => showFrom(e.target)}
        onBlur={() => setDetail(null)}
      >
        {children}
      </div>
      {/* Mounted only when chosen: a 500-book wall would otherwise carry
          a hidden 500-row table per shelf, doubling the DOM. */}
      {list && view === "list" && <div>{list}</div>}
      <div className={s.detail} aria-hidden="true">
        {detail && <p className={s.detailInner}>{detail}</p>}
      </div>
    </div>
  );
}
