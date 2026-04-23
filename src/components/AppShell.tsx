import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Users, Trophy, Shield, Wallet, LogOut, Menu, X, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/socios", label: "Sócios", icon: Shield },
  { to: "/metodos", label: "Métodos", icon: Trophy },
  { to: "/mensalidades", label: "Mensalidades", icon: Wallet },
  { to: "/recebimentos", label: "Recebimentos", icon: Receipt },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card">
        <SidebarContent onNavigate={() => {}} currentPath={location.pathname} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col animate-in slide-in-from-left">
            <SidebarContent
              onNavigate={() => setOpen(false)}
              currentPath={location.pathname}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/80 backdrop-blur px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <BrandMark />
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <img
        src={logo}
        alt="R Sports"
        className="h-10 w-10 rounded-lg object-contain shadow-[var(--shadow-elegant)]"
      />
      <div className="leading-tight">
        <div className="font-display font-extrabold text-base">R Sports</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gestão</div>
      </div>
    </div>
  );
}

function SidebarContent({
  onNavigate,
  currentPath,
  onLogout,
}: {
  onNavigate: () => void;
  currentPath: string;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <BrandMark />
        <button
          className="lg:hidden p-1 rounded-md hover:bg-muted"
          onClick={onNavigate}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = currentPath === item.to || currentPath.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
                  : "text-foreground/70 hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  );
}
