import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PageHeader } from "@/components/PeopleManager";
import { useMemo } from "react";
import type { Person, Payment } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { brl, calcAge, formatDate, isBirthdayToday, todayISO } from "@/lib/format";
import {
  Wallet, Receipt, AlertTriangle, Clock, Cake, Users, Shield, Trophy, Loader2,
} from "lucide-react";
import { usePeople, usePayments } from "@/lib/queries";

export const Route = createFileRoute("/painel")({
  component: () => (
    <ProtectedLayout>
      <Dashboard />
    </ProtectedLayout>
  ),
});

function Dashboard() {
  const { data: people = [] } = usePeople();
  const { data: payments = [] } = usePayments();

  const stats = useMemo(() => {
    const today = todayISO();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7str = in7.toISOString().slice(0, 10);

    const paidToday = payments.filter((p) => p.status === "pago" && p.payment_date === today);
    const totalToday = paidToday.reduce((s, p) => s + Number(p.amount), 0);
    const overdue = payments.filter((p) => p.status !== "pago" && p.due_date < today);
    const upcoming = payments.filter((p) => p.status === "pendente" && p.due_date >= today && p.due_date <= in7str);

    const activeBy = (cat: string) =>
      people.filter((p) => p.category === cat && p.status === "ativo").length;

    const birthdays = people.filter((p) => isBirthdayToday(p.birth_date));

    return {
      totalToday,
      countToday: paidToday.length,
      overdue,
      upcoming,
      birthdays,
      activeAlunos: activeBy("aluno"),
      activeSocios: activeBy("socio"),
      activeMetodos: activeBy("metodo"),
    };
  }, [people, payments]);

  return (
    <div className="space-y-6">
      <PageHeader title="Painel" description="Visão geral da operação do dia." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Recebido hoje"
          value={brl(stats.totalToday)}
          icon={Wallet}
          accent
        />
        <StatCard
          label="Pagos hoje"
          value={String(stats.countToday)}
          icon={Receipt}
        />
        <StatCard
          label="A vencer (7d)"
          value={String(stats.upcoming.length)}
          icon={Clock}
        />
        <StatCard
          label="Vencidas"
          value={String(stats.overdue.length)}
          icon={AlertTriangle}
          danger={stats.overdue.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <CountCard label="Alunos ativos" value={stats.activeAlunos} icon={Users} to="/alunos" />
        <CountCard label="Sócios ativos" value={stats.activeSocios} icon={Shield} to="/socios" />
        <CountCard label="Métodos ativos" value={stats.activeMetodos} icon={Trophy} to="/metodos" />
      </div>

      {/* Birthdays */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-accent/15 text-accent-foreground flex items-center justify-center">
            <Cake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">Aniversariantes do dia</h2>
            <p className="text-xs text-muted-foreground">
              {stats.birthdays.length === 0 ? "Nenhum aniversário hoje" : `${stats.birthdays.length} pessoa(s) comemoram hoje`}
            </p>
          </div>
        </div>
        {stats.birthdays.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            🎂 Nenhum aniversariante cadastrado para hoje.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {stats.birthdays.map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="h-10 w-10 shrink-0 rounded-full bg-[image:var(--gradient-accent)] flex items-center justify-center text-accent-foreground font-bold">
                  {p.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[p.category]} · {calcAge(p.birth_date)} anos
                  </div>
                  {(p.guardian_name || p.phone) && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {p.guardian_name && <>Resp.: {p.guardian_name} · </>}
                      {p.phone}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Upcoming + Overdue lists */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ListCard
          title="Próximos vencimentos (7 dias)"
          items={stats.upcoming.slice(0, 6)}
          people={people}
          empty="Sem vencimentos próximos."
        />
        <ListCard
          title="Mensalidades vencidas"
          items={stats.overdue.slice(0, 6)}
          people={people}
          empty="Nenhum inadimplente. 🎉"
          danger
        />
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent, danger,
}: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean; danger?: boolean;
}) {
  return (
    <Card className={
      "p-4 sm:p-5 relative overflow-hidden " +
      (accent ? "bg-[image:var(--gradient-brand)] text-primary-foreground border-transparent" : "")
    }>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={"text-xs uppercase tracking-wider " + (accent ? "opacity-80" : "text-muted-foreground")}>
            {label}
          </div>
          <div className={"font-display font-extrabold text-2xl sm:text-3xl mt-1 " + (danger ? "text-destructive" : "")}>
            {value}
          </div>
        </div>
        <div className={
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 " +
          (accent ? "bg-accent/30 text-accent-foreground" : danger ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground/70")
        }>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function CountCard({
  label, value, icon: Icon, to,
}: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  to: "/alunos" | "/socios" | "/metodos";
}) {
  return (
    <Link to={to}>
      <Card className="p-5 hover:border-accent transition-colors cursor-pointer group">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="font-display font-extrabold text-3xl mt-1">{value}</div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-muted group-hover:bg-accent/15 flex items-center justify-center transition-colors">
            <Icon className="h-6 w-6 text-foreground/70" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ListCard({
  title, items, people, empty, danger,
}: {
  title: string;
  items: Payment[];
  people: Person[];
  empty: string;
  danger?: boolean;
}) {
  const findPerson = (id: string) => people.find((p) => p.id === id);
  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-base mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const person = findPerson(p.person_id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-muted/40">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{person?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {person && CATEGORY_LABELS[person.category]} · vence {formatDate(p.due_date)}
                  </div>
                </div>
                <div className={"text-sm font-semibold " + (danger ? "text-destructive" : "")}>
                  {brl(Number(p.amount))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
