import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PageHeader, PaymentStatusBadge } from "@/components/PeopleManager";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Person, Payment, PersonCategory, PaymentStatus } from "@/lib/types";
import { CATEGORY_LABELS, MONTHLY_FEE } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { brl, competenceLabel, formatDate, todayISO } from "@/lib/format";
import { Loader2, CheckCircle2, Plus, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mensalidades")({
  component: () => (
    <ProtectedLayout>
      <PaymentsPage />
    </ProtectedLayout>
  ),
});

type FilterStatus = "todos" | PaymentStatus | "recebidos_hoje" | "vencendo";

function PaymentsPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<"todas" | PersonCategory>("todas");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("todos");
  const [search, setSearch] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  const [paying, setPaying] = useState<Payment | null>(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState("Dinheiro");
  const [payNotes, setPayNotes] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genCompetence, setGenCompetence] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [genCategory, setGenCategory] = useState<"todas" | PersonCategory>("todas");
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ppl }, { data: pays }] = await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("payments").select("*").order("due_date", { ascending: false }),
    ]);
    setPeople((ppl ?? []) as Person[]);
    setPayments((pays ?? []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const personById = useMemo(() => {
    const m = new Map<string, Person>();
    people.forEach((p) => m.set(p.id, p));
    return m;
  }, [people]);

  const filtered = useMemo(() => {
    const today = todayISO();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7str = in7.toISOString().slice(0, 10);

    return payments.filter((pay) => {
      const person = personById.get(pay.person_id);
      if (!person) return false;
      if (categoryFilter !== "todas" && person.category !== categoryFilter) return false;

      if (statusFilter === "recebidos_hoje") {
        if (!(pay.status === "pago" && pay.payment_date === today)) return false;
      } else if (statusFilter === "vencendo") {
        if (!(pay.status === "pendente" && pay.due_date >= today && pay.due_date <= in7str)) return false;
      } else if (statusFilter === "atrasado") {
        if (!(pay.status !== "pago" && pay.due_date < today)) return false;
      } else if (statusFilter !== "todos") {
        if (pay.status !== statusFilter) return false;
      }

      if (periodFrom && pay.due_date < periodFrom) return false;
      if (periodTo && pay.due_date > periodTo) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        if (!person.full_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [payments, personById, categoryFilter, statusFilter, search, periodFrom, periodTo]);

  const totalReceived = filtered
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + Number(p.amount), 0);

  const openPay = (p: Payment) => {
    setPaying(p);
    setPayDate(p.payment_date ?? todayISO());
    setPayMethod(p.payment_method ?? "Dinheiro");
    setPayNotes(p.notes ?? "");
  };

  const confirmPay = async () => {
    if (!paying) return;
    setSavingPay(true);
    const { error } = await supabase
      .from("payments")
      .update({
        status: "pago",
        payment_date: payDate,
        payment_method: payMethod,
        notes: payNotes.trim() || null,
      })
      .eq("id", paying.id);
    setSavingPay(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Pagamento registrado");
      setPaying(null);
      await load();
    }
  };

  const generateBatch = async () => {
    setGenerating(true);
    const targets = people.filter((p) =>
      p.status === "ativo" && (genCategory === "todas" || p.category === genCategory)
    );
    const [y, m] = genCompetence.split("-").map(Number);
    const existing = new Set(
      payments.filter((p) => p.competence === genCompetence).map((p) => p.person_id)
    );
    const rows = targets
      .filter((p) => !existing.has(p.id))
      .map((p) => {
        const day = Math.min(p.due_day, 28);
        const due = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return {
          person_id: p.id,
          competence: genCompetence,
          amount: MONTHLY_FEE,
          due_date: due,
          status: "pendente" as const,
        };
      });

    if (rows.length === 0) {
      toast.info("Nenhuma mensalidade nova a gerar (já existem para essa competência)");
      setGenerating(false);
      return;
    }
    const { error } = await supabase.from("payments").insert(rows);
    setGenerating(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${rows.length} mensalidade(s) geradas`);
      setGenOpen(false);
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <PageHeader title="Mensalidades" description="Controle financeiro unificado." />
        <Button onClick={() => setGenOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Gerar mensalidades
        </Button>
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Buscar nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              <SelectItem value="aluno">Alunos</SelectItem>
              <SelectItem value="socio">Sócios</SelectItem>
              <SelectItem value="metodo">Métodos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado/Inadimplente</SelectItem>
              <SelectItem value="recebidos_hoje">Recebidos hoje</SelectItem>
              <SelectItem value="vencendo">Vencendo (7 dias)</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> registro(s)
          </div>
          <div className="text-sm">
            Total recebido (filtro): <span className="font-bold text-success">{brl(totalReceived)}</span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma mensalidade encontrada.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold">Categoria</th>
                    <th className="text-left px-4 py-3 font-semibold">Competência</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Pagamento</th>
                    <th className="text-right px-4 py-3 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pay) => {
                    const person = personById.get(pay.person_id);
                    return (
                      <tr key={pay.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{person?.full_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{person && CATEGORY_LABELS[person.category]}</td>
                        <td className="px-4 py-3">{competenceLabel(pay.competence)}</td>
                        <td className="px-4 py-3">{formatDate(pay.due_date)}</td>
                        <td className="px-4 py-3 font-semibold">{brl(Number(pay.amount))}</td>
                        <td className="px-4 py-3"><PaymentStatusBadge status={pay.status} dueDate={pay.due_date} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {pay.payment_date ? `${formatDate(pay.payment_date)} · ${pay.payment_method ?? "—"}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pay.status !== "pago" && (
                            <Button size="sm" variant="outline" onClick={() => openPay(pay)} className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-border">
              {filtered.map((pay) => {
                const person = personById.get(pay.person_id);
                return (
                  <div key={pay.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{person?.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {person && CATEGORY_LABELS[person.category]} · {competenceLabel(pay.competence)}
                        </div>
                      </div>
                      <PaymentStatusBadge status={pay.status} dueDate={pay.due_date} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Vence {formatDate(pay.due_date)}</span>
                      <span className="font-bold">{brl(Number(pay.amount))}</span>
                    </div>
                    {pay.status !== "pago" && (
                      <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => openPay(pay)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Registrar pagamento
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Pay dialog */}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {paying && personById.get(paying.person_id)?.full_name} — {paying && competenceLabel(paying.competence)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={confirmPay} disabled={savingPay}>
              {savingPay ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar mensalidades em lote</DialogTitle>
            <DialogDescription>
              Cria mensalidades de {brl(MONTHLY_FEE)} para todos os cadastros ativos da seleção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Competência (mês/ano)</Label>
              <Input type="month" value={genCompetence} onChange={(e) => setGenCompetence(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={genCategory} onValueChange={(v) => setGenCategory(v as typeof genCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  <SelectItem value="aluno">Apenas alunos</SelectItem>
                  <SelectItem value="socio">Apenas sócios</SelectItem>
                  <SelectItem value="metodo">Apenas métodos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={generateBatch} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
