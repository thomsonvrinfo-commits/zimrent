import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home, MessageSquare, User, Building2, Heart, Shield, Bell, Menu, LogOut, Plus, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = {
  tenant: [
    { label: "Discover", to: "/", icon: Home },
    { label: "My Dashboard", to: "/tenant-dashboard", icon: LayoutDashboard },
    { label: "Saved", to: "/tenant-dashboard?tab=saved", icon: Heart, hide: true },
    { label: "Messages", to: "/messages", icon: MessageSquare },
    { label: "Profile", to: "/profile", icon: User }
  ],
  owner: [
    { label: "Discover", to: "/", icon: Home },
    { label: "Owner Dashboard", to: "/owner-dashboard", icon: LayoutDashboard },
    { label: "My Properties", to: "/my-properties", icon: Building2 },
    { label: "Add Property", to: "/add-property", icon: Plus },
    { label: "Messages", to: "/messages", icon: MessageSquare },
    { label: "Profile", to: "/profile", icon: User }
  ],
  agent: [
    { label: "Discover", to: "/", icon: Home },
    { label: "My Properties", to: "/my-properties", icon: Building2 },
    { label: "Add Property", to: "/add-property", icon: Plus },
    { label: "Messages", to: "/messages", icon: MessageSquare },
    { label: "Profile", to: "/profile", icon: User }
  ],
  admin: [
    { label: "Discover", to: "/", icon: Home },
    { label: "Admin Console", to: "/admin", icon: Shield },
    { label: "Messages", to: "/messages", icon: MessageSquare },
    { label: "Profile", to: "/profile", icon: User }
  ]
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { profile, loading, isAdmin } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

 const role = user?.role || profile?.data?.role || "tenant";
  const navItems = NAV_SECTIONS[role] || NAV_SECTIONS.tenant;
  const effectiveNav = isAdmin ? NAV_SECTIONS.admin : navItems;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const notifs = await zimrent.entities.Notification.filter({ user_id: user.id }, "-created_date", 20);
        if (active) setNotifications(notifs || []);
      } catch (e) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [user, location.pathname]);

  const unreadCount = notifications.filter(n => !n.data?.read).length;

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.data?.read);
    for (const n of unread) {
      try { await zimrent.entities.Notification.update(n.id, { read: true }); } catch (e) {}
    }
    setNotifications(notifications.map(n => ({ ...n, data: { ...n.data, read: true } })));
  };

  const handleLogout = () => {
    logout();
  };

  const initials = (profile?.data?.display_name || user?.display_name || user?.email || "U")
    .split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-sidebar z-30">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-heading font-bold text-foreground leading-tight">Dzimba</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rental Platform</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {effectiveNav.filter(item => !item.hide).map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {item.label}
                {item.label === "Messages" && unreadCount > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{unreadCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border">
          <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.data?.display_name || user?.display_name || "User"}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors mt-1">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-primary-foreground" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-heading font-bold">Dzimba</span>
          </Link>
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 -mr-2">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl flex flex-col animate-fade-in">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-heading font-bold">Dzimba</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-2 text-muted-foreground">✕</button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {effectiveNav.filter(item => !item.hide).map(item => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to}
                    className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium",
                      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                    <Icon className="w-5 h-5" /> {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 py-3 border-t border-border">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop notification panel */}
      <div className="hidden lg:block">
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
            <div className="fixed top-16 right-6 w-80 bg-card border border-border rounded-xl shadow-xl z-40 animate-scale-in">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>}
              </div>
              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
                ) : notifications.map(n => (
                  <Link key={n.id} to={n.data?.link || "#"} onClick={() => setNotifOpen(false)}
                    className={cn("block px-4 py-3 border-b border-border hover:bg-muted transition-colors", !n.data?.read && "bg-primary/5")}>
                    <p className="text-sm font-medium">{n.data?.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.data?.message}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border h-16 items-center justify-between px-8">
          <div>
            {!profile && !loading && (
              <Link to="/profile" className="text-sm text-warning hover:underline">
                Complete your profile to get started →
              </Link>
            )}
          </div>
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2.5 rounded-lg hover:bg-muted transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
        </header>
        <main className="min-h-[calc(100vh-3.5rem)] lg:min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}