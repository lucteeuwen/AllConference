import Link from "next/link";

export type Tab = {
  key: string;
  label: string;
  href: string;
};

type Props = {
  tabs: Tab[];
  active: string;
  /** Light variant sits on the navy hero, dark variant on the page ground. */
  tone?: "light" | "dark";
};

/** Underline tab bar. Selection lives in the URL, so tabs are linkable. */
export function Tabs({ tabs, active, tone = "dark" }: Props) {
  const base = tone === "light" ? "text-white/55" : "text-ink-muted";
  const on = tone === "light" ? "text-white" : "text-accent";
  const rule = tone === "light" ? "bg-white" : "bg-accent";

  return (
    <div
      className={`no-scrollbar flex gap-1 overflow-x-auto ${
        tone === "light" ? "border-b border-white/15" : "border-b border-line"
      }`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={`relative shrink-0 px-4 py-3 text-[13px] font-semibold whitespace-nowrap transition ${
              selected ? on : `${base} hover:opacity-80`
            }`}
          >
            {tab.label}
            {selected ? (
              <span className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full ${rule}`} />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
