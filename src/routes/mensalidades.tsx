import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PageHeader, PaymentStatusBadge } from "@/components/PeopleManager";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Person, Payment, PersonCategory, PaymentStatus } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
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
import { usePeople, usePayments, useInvalidateData, useFeeMap } from "@/lib/queries";

const addDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const monthStartISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const monthEndISO = () => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};
import { Loader2, CheckCircle2, Plus, Filter, TrendingUp, Pencil } from "lucide-react";
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
  const { data: people = [], isLoading: l1 } = usePeople();
  const { data: payments = [], isLoading: l2 } = usePayments();
  const { invalidatePayments } = useInvalidateData();
  const loading = l1 || l2;
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

  // Reajuste de valores
  const { fees } = useFeeMap();
  const { invalidateFees } = useInvalidateData();
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjValues, setAdjValues] = useState<Record<PersonCategory, string>>({
    aluno: "", socio: "", metodo: "",
  });
  const [adjApplyOpen, setAdjApplyOpen] = useState(true);
  const [adjFrom, setAdjFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [savingAdj, setSavingAdj] = useState(false);

  // Edição de valor individual
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const openAdjust = () => {
    setAdjValues({
      aluno: String(fees.aluno),
      socio: String(fees.socio),
      metodo: String(fees.metodo),
    });
    setAdjOpen(true);
  };

  const saveAdjust = async () => {
    const cats: PersonCategory[] = ["aluno", "socio", "metodo"];
    const parsed = cats.map((c) => ({ c, v: Number(String(adjValues[c]).replace(",", ".")) }));
    if (parsed.some((p) => !Number.isFinite(p.v) || p.v <= 0)) {
      toast.error("Informe valores válidos para todas as categorias");
      return;
    }
    setSavingAdj(true);
    for (const { c, v } of parsed) {
      const { error } = await supabase
        .from("fee_settings")
        .update({ amount: v })
        .eq("category", c);
      if (error) {
        setSavingAdj(false);
        toast.error(error.message);
        return;
      }
    }

    let updated = 0;
    if (adjApplyOpen) {
      for (const { c, v } of parsed) {
        const ids = payments
          .filter((pay) => {
            const person = personById.get(pay.person_id);
            return (
              person?.category === c &&
              pay.status !== "pago" &&
              pay.competence >= adjFrom &&
              Number(pay.amount) !== v
            );
          })
          .map((pay) => pay.id);
        if (ids.length === 0) continue;
        const { error } = await supabase.from("payments").update({ amount: v }).in("id", ids);
        if (error) {
          setSavingAdj(false);
          toast.error(error.message);
          return;
        }
        updated += ids.length;
      }
    }

    setSavingAdj(false);
    setAdjOpen(false);
    invalidateFees();
    invalidatePayments();
    toast.success(
      adjApplyOpen
        ? `Valores reajustados · ${updated} mensalidade(s) em aberto atualizadas`
        : "Valores reajustados",
    );
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setEditAmount(String(Number(p.amount)));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const v = Number(String(editAmount).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase.from("payments").update({ amount: v }).eq("id", editing.id);
    setSavingEdit(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Valor atualizado");
      setEditing(null);
      invalidatePayments();
    }
  };

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
      invalidatePayments();
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
          amount: fees[p.category],
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
      invalidatePayments();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <PageHeader title="Mensalidades" description="Controle financeiro unificado." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openAdjust} className="gap-2">
            <TrendingUp className="h-4 w-4" /> Reajustar valores
          </Button>
          <Button onClick={() => setGenOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Gerar mensalidades
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtros
        </div>

        {/* Categoria - chips */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</div>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "todas", label: "Todas" },
              { v: "aluno", label: "Alunos" },
              { v: "socio", label: "Sócios" },
              { v: "metodo", label: "Métodos" },
            ] as const).map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => setCategoryFilter(c.v as typeof categoryFilter)}
                className={
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
                  (categoryFilter === c.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground/70 hover:bg-muted")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Período - chips rápidos */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período (vencimento)</div>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "all", label: "Todo período" },
              { v: "today", label: "Hoje" },
              { v: "7d", label: "Próx. 7 dias" },
              { v: "month", label: "Este mês" },
            ] as const).map((p) => {
              const active =
                (p.v === "all" && !periodFrom && !periodTo) ||
                (p.v === "today" && periodFrom === todayISO() && periodTo === todayISO()) ||
                (p.v === "7d" && periodFrom === todayISO() && periodTo === addDaysISO(7)) ||
                (p.v === "month" && periodFrom === monthStartISO() && periodTo === monthEndISO());
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => {
                    if (p.v === "all") { setPeriodFrom(""); setPeriodTo(""); }
                    else if (p.v === "today") { setPeriodFrom(todayISO()); setPeriodTo(todayISO()); }
                    else if (p.v === "7d") { setPeriodFrom(todayISO()); setPeriodTo(addDaysISO(7)); }
                    else if (p.v === "month") { setPeriodFrom(monthStartISO()); setPeriodTo(monthEndISO()); }
                  }}
                  className={
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
                    (active
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-background border-border text-foreground/70 hover:bg-muted")
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Buscar nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(pay)} className="gap-1">
                              <Pencil className="h-3.5 w-3.5" /> Valor
                            </Button>
                            {pay.status !== "pago" && (
                              <Button size="sm" variant="outline" onClick={() => openPay(pay)} className="gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                              </Button>
                            )}
                          </div>
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => openEdit(pay)}>
                        <Pencil className="h-3.5 w-3.5" /> Alterar valor
                      </Button>
                      {pay.status !== "pago" && (
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openPay(pay)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                        </Button>
                      )}
                    </div>
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

      {/* Adjust values dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reajustar valores</DialogTitle>
            <DialogDescription>
              Defina o novo valor da mensalidade por categoria. O valor passa a valer para as próximas mensalidades geradas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(["aluno", "socio", "metodo"] as PersonCategory[]).map((c) => (
              <div key={c} className="space-y-2">
                <Label>{CATEGORY_LABELS[c]} — valor atual {brl(fees[c])}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjValues[c]}
                  onChange={(e) => setAdjValues((v) => ({ ...v, [c]: e.target.value }))}
                />
              </div>
            ))}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={adjApplyOpen}
                  onChange={(e) => setAdjApplyOpen(e.target.checked)}
                />
                <span>Aplicar também nas mensalidades em aberto (pendentes/atrasadas)</span>
              </label>
              {adjApplyOpen && (
                <div className="space-y-2">
                  <Label>A partir da competência</Label>
                  <Input type="month" value={adjFrom} onChange={(e) => setAdjFrom(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Mensalidades já pagas não são alteradas.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>Cancelar</Button>
            <Button onClick={saveAdjust} disabled={savingAdj}>
              {savingAdj ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar reajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit single amount dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar valor da mensalidade</DialogTitle>
            <DialogDescription>
              {editing && personById.get(editing.person_id)?.full_name} — {editing && competenceLabel(editing.competence)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
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
              Cria mensalidades com o valor atual de cada categoria (Alunos {brl(fees.aluno)} · Sócios {brl(fees.socio)} · Métodos {brl(fees.metodo)}).
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
