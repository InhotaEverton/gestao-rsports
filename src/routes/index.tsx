import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import fieldBg from "@/assets/field-bg.jpg";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, ready } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && isAuthenticated) navigate({ to: "/painel", replace: true });
  }, [ready, isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const ok = login(user.trim(), pass);
    if (ok) {
      toast.success("Bem-vindo!");
      // Hard navigation guarantees no waiting on React state propagation
      navigate({ to: "/painel", replace: true });
    } else {
      toast.error("Usuário ou senha inválidos");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative bg-background bg-cover bg-center flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundImage: `url(${fieldBg})` }}
    >
      {/* Overlay tint over the field for legibility */}
      <div className="absolute inset-0 bg-[image:var(--gradient-brand)]/55" />
      <div className="absolute inset-0 bg-foreground/10" />

      {/* Login card */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm space-y-6 bg-card/95 backdrop-blur-md p-7 sm:p-8 rounded-2xl shadow-[var(--shadow-elegant)] border border-border/50"
      >
        <div className="flex flex-col items-center gap-3">
          <img
            src={logo}
            alt="R Sports"
            className="h-16 w-16 rounded-2xl object-contain shadow-[var(--shadow-elegant)]"
          />
          <div className="text-center">
            <div className="font-display font-extrabold text-2xl text-foreground">R Sports</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">
              Gestão Interna
            </div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="font-display font-extrabold text-2xl text-foreground">Acessar painel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Entre com suas credenciais para continuar.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user">Usuário</Label>
          <Input
            id="user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Admin"
            autoComplete="username"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pass">Senha</Label>
          <div className="relative">
            <Input
              id="pass"
              type={show ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted"
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </Button>

        <div className="text-[11px] text-muted-foreground text-center">
          © {new Date().getFullYear()} R Sports
        </div>
      </form>
    </div>
  );
}
