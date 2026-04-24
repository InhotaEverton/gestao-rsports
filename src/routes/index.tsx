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
    if (ready && isAuthenticated) navigate({ to: "/painel" });
  }, [ready, isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(user.trim(), pass);
    if (ok) {
      toast.success("Bem-vindo!");
      navigate({ to: "/painel" });
    } else {
      toast.error("Usuário ou senha inválidos");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen grid lg:grid-cols-2 bg-background bg-cover bg-center"
      style={{ backgroundImage: `url(${fieldBg})` }}
    >
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-[image:var(--gradient-brand)]/90 backdrop-blur-sm text-primary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="R Sports"
            className="h-14 w-14 rounded-xl object-contain bg-white shadow-[var(--shadow-glow)]"
          />
          <div>
            <div className="font-display font-extrabold text-2xl tracking-tight">R Sports</div>
            <div className="text-xs opacity-80 uppercase tracking-widest">Football Society</div>
          </div>
        </div>
        <div>
          <h1 className="font-display font-extrabold text-5xl leading-tight">
            Gestão simples.<br />
            Time forte.
          </h1>
          <p className="mt-4 text-base opacity-80 max-w-md">
            Sistema interno para gerenciar alunos, sócios, métodos e mensalidades da escolinha.
          </p>
        </div>
        <div className="text-xs opacity-60">© {new Date().getFullYear()} R Sports — Todos os direitos reservados.</div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl pointer-events-none" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background/80 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src={logo}
              alt="R Sports"
              className="h-12 w-12 rounded-xl object-contain shadow-[var(--shadow-elegant)]"
            />
            <div className="font-display font-extrabold text-2xl">R Sports</div>
          </div>
          <div>
            <h2 className="font-display font-extrabold text-3xl text-foreground">Acessar painel</h2>
            <p className="text-sm text-muted-foreground mt-1">Entre com suas credenciais para continuar.</p>
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
        </form>
      </div>
    </div>
  );
}
