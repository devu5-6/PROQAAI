import { MagnifyingGlass, CalendarBlank, Bell, User } from "@phosphor-icons/react";

interface TopbarProps {
  search: string;
  onSearch: (value: string) => void;
}

export function Topbar({ search, onSearch }: TopbarProps) {
  return (
    <div className="topbar">
      <label className="search">
        <span className="sr-only">Search patients by name or reason</span>
        <input
          type="search"
          value={search}
          placeholder="Search"
          onChange={(e) => onSearch(e.target.value)}
        />
        <span className="search-icon" aria-hidden="true">
          <MagnifyingGlass size={16} />
        </span>
      </label>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" aria-label="Calendar" title="Calendar">
          <CalendarBlank size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Notifications" title="Notifications">
          <Bell size={18} />
        </button>
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">
            <User size={18} weight="fill" />
          </span>
          <span className="who">
            <span className="name">Front desk</span>
            <span className="meta">Desk 1 · Main clinic</span>
          </span>
        </div>
      </div>
    </div>
  );
}
