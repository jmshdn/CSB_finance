import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, ArrowLeftRight, Wallet, ChevronDown, Users, DollarSign, Settings, LogOut, Shield, Clock } from "lucide-react";
import csbLogo from "@/assets/csb-logo.png";
import { useState } from "react";
import MonthSelector from "@/components/MonthSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams } from "@/hooks/useTeams";

const mainNav = [
  { to: "/", icon: BarChart3, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/settlements", icon: Clock, label: "Settlements" },
  { to: "/salary", icon: DollarSign, label: "Salary" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
  }`;

const dropdownLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
  }`;

const iconNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
    isActive ? "border-primary/30 bg-secondary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
  }`;

const iconMenuButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground";

export default function Layout() {
  const [walletsOpen, setWalletsOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile, role, signOut } = useAuth();
  const { data: teams = [] } = useTeams();

  const closeAllNavMenus = () => {
    setWalletsOpen(false);
    setPerfOpen(false);
  };

  const roleLabel = role === "admin" ? "Admin" : role === "team_leader" ? "Team Leader" : "User";
  const compactDropdownClass = "absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border bg-card p-1 shadow-lg";

  const renderDesktopNav = () => {
    const dropdownClass = "absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border bg-card p-1 shadow-lg";

    return (
      <nav className="flex items-center gap-1">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={navLinkClass}
            onClick={closeAllNavMenus}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        <div className="relative">
          <button
            onClick={() => {
              setPerfOpen(false);
              setWalletsOpen(!walletsOpen);
            }}
            onBlur={() => setTimeout(() => setWalletsOpen(false), 150)}
            className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Wallet className="h-4 w-4" />
            Wallets
            <ChevronDown className="h-3 w-3" />
          </button>
          {walletsOpen && (
            <div className={dropdownClass}>
              <NavLink
                to="/wallet"
                className={dropdownLinkClass}
                onClick={closeAllNavMenus}
              >
                CSB Wallet
              </NavLink>
              <div className="my-1 border-t pt-1">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team Wallets</p>
                {teams.map((team) => (
                  <NavLink
                    key={`wallet-${team}`}
                    to={`/team/${team}`}
                    className={({ isActive }) => `${dropdownLinkClass({ isActive })} pl-6`}
                    onClick={closeAllNavMenus}
                  >
                    {team}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setWalletsOpen(false);
              setPerfOpen(!perfOpen);
            }}
            onBlur={() => setTimeout(() => setPerfOpen(false), 150)}
            className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Users className="h-4 w-4" />
            Performance
            <ChevronDown className="h-3 w-3" />
          </button>
          {perfOpen && (
            <div className={dropdownClass}>
              <NavLink
                to="/teams"
                end
                className={dropdownLinkClass}
                onClick={closeAllNavMenus}
              >
                All Teams Overview
              </NavLink>
              <div className="my-1 border-t pt-1">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team Performance</p>
                {teams.map((team) => (
                  <NavLink
                    key={`perf-${team}`}
                    to={`/team-performance/${team}`}
                    className={({ isActive }) => `${dropdownLinkClass({ isActive })} pl-6`}
                    onClick={closeAllNavMenus}
                  >
                    {team}
                  </NavLink>
                ))}
              </div>
              <div className="my-1 border-t" />
              <NavLink
                to="/earnings"
                className={dropdownLinkClass}
                onClick={closeAllNavMenus}
              >
                Member Earnings
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <NavLink to="/" className="block h-9 w-9 shrink-0 overflow-hidden rounded-full">
              <img src={csbLogo} alt="CSB Finance" className="h-full w-full scale-150 object-cover object-center" />
            </NavLink>
            <div className="hidden xl:block">{renderDesktopNav()}</div>
            <nav className="flex items-center gap-1 xl:hidden">
              {mainNav.map((item) => (
                <NavLink
                  key={`icon-${item.to}`}
                  to={item.to}
                  end={item.to === "/"}
                  className={iconNavLinkClass}
                  title={item.label}
                  aria-label={item.label}
                  onClick={closeAllNavMenus}
                >
                  <item.icon className="h-4 w-4" />
                </NavLink>
              ))}

              <div className="relative">
                <button
                  type="button"
                  className={iconMenuButtonClass}
                  title="Wallets"
                  aria-label="Wallets"
                  onClick={() => {
                    setPerfOpen(false);
                    setWalletsOpen((open) => !open);
                  }}
                  onBlur={() => setTimeout(() => setWalletsOpen(false), 150)}
                >
                  <Wallet className="h-4 w-4" />
                </button>
                {walletsOpen && (
                  <div className={compactDropdownClass}>
                    <NavLink to="/wallet" className={dropdownLinkClass} onClick={closeAllNavMenus}>
                      CSB Wallet
                    </NavLink>
                    <div className="my-1 border-t pt-1">
                      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team Wallets</p>
                      {teams.map((team) => (
                        <NavLink
                          key={`compact-wallet-${team}`}
                          to={`/team/${team}`}
                          className={({ isActive }) => `${dropdownLinkClass({ isActive })} pl-6`}
                          onClick={closeAllNavMenus}
                        >
                          {team}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  className={iconMenuButtonClass}
                  title="Performance"
                  aria-label="Performance"
                  onClick={() => {
                    setWalletsOpen(false);
                    setPerfOpen((open) => !open);
                  }}
                  onBlur={() => setTimeout(() => setPerfOpen(false), 150)}
                >
                  <Users className="h-4 w-4" />
                </button>
                {perfOpen && (
                  <div className={compactDropdownClass}>
                    <NavLink to="/teams" className={dropdownLinkClass} onClick={closeAllNavMenus}>
                      All Teams Overview
                    </NavLink>
                    <div className="my-1 border-t pt-1">
                      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team Performance</p>
                      {teams.map((team) => (
                        <NavLink
                          key={`compact-perf-${team}`}
                          to={`/team-performance/${team}`}
                          className={({ isActive }) => `${dropdownLinkClass({ isActive })} pl-6`}
                          onClick={closeAllNavMenus}
                        >
                          {team}
                        </NavLink>
                      ))}
                    </div>
                    <div className="my-1 border-t" />
                    <NavLink to="/earnings" className={dropdownLinkClass} onClick={closeAllNavMenus}>
                      Member Earnings
                    </NavLink>
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <div className="min-w-0">
              <MonthSelector />
            </div>

            <div className="relative flex items-center border-l pl-3">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                onBlur={() => setTimeout(() => setProfileOpen(false), 150)}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-right transition-colors hover:bg-muted/60"
              >
                <div className="hidden sm:block">
                  <p className="text-xs font-medium leading-tight">{profile?.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border bg-card p-1 shadow-lg">
                  <NavLink to="/settings" className={dropdownLinkClass} onClick={() => setProfileOpen(false)}>
                    <span className="flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5" />
                      Profile & Settings
                    </span>
                  </NavLink>
                  {role === "admin" && (
                    <NavLink to="/members" className={dropdownLinkClass} onClick={() => setProfileOpen(false)}>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Members
                      </span>
                    </NavLink>
                  )}
                  {role === "admin" && (
                    <NavLink to="/admin" className={dropdownLinkClass} onClick={() => setProfileOpen(false)}>
                      <span className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        Admin Panel
                      </span>
                    </NavLink>
                  )}
                  <div className="my-1 border-t" />
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
        <Outlet />
      </main>
    </div>
  );
}
