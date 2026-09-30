import {
  House,
  Heartbeat,
  Dna,
  Tooth,
  ChartBar,
  Gear,
  SignOut,
  Moon,
  Sun,
  HeartbeatIcon,
} from "@phosphor-icons/react";

interface SidebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: House },
  { id: "vitals", label: "Vitals", icon: Heartbeat },
  { id: "dna", label: "DNA", icon: Dna },
  { id: "dental", label: "Dental", icon: Tooth },
  { id: "stats", label: "Statistics", icon: ChartBar },
  { id: "settings", label: "Settings", icon: Gear },
];

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-brand" aria-hidden="true">
        <HeartbeatIcon size={32} />
      </div>
      <nav className="sidebar-nav" aria-label="Sections">
        {NAV_ITEMS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-btn ${i === 0 ? "active" : ""}`}
            aria-label={item.label}
            aria-current={i === 0 ? "page" : undefined}
            title={item.label}
          >
            <item.icon size={19} weight={i === 0 ? "fill" : "regular"} />
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <button type="button" className="sidebar-btn" aria-label="Sign out" title="Sign out">
        <SignOut size={19} />
      </button>
      <button
        type="button"
        className="theme-toggle"
        role="switch"
        aria-checked={theme === "dark"}
        aria-label={`Dark theme ${theme === "dark" ? "on" : "off"}`}
        onClick={onToggleTheme}
      >
        <span className="knob" aria-hidden="true">
          {theme === "dark" ? <Moon size={12} weight="fill" /> : <Sun size={12} weight="fill" />}
        </span>
      </button>
    </aside>
  );
}
