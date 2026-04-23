import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PageHeader, PaymentStatusBadge } from "@/components/PeopleManager";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Person, Payment } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { brl, competenceLabel, formatDate, todayISO } from "@/lib/format";
import { Loader2, CheckCircle2, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/recebimentos")({
  component: () => (
    <ProtectedLayout>
      <DailyReceiptsPage />
    </ProtectedLayout>
  ),
});

function DailyReceiptsPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState("Dinheiro");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ppl }, { data: pays }] = await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("payments").select("*").order("due_date", { ascending: true }),
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

  // Pendentes (pendente ou atrasado)
  const pending = useMemo(() => {
    const today = todayISO();
    return payments
      .filter((p) => p.status !== "pago")
      .filter((p) => {
        const person = personById.get(p.person_id);
        if (!person) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!person.full_name.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // overdue first, then by due_date
        const aOver = a.due_date < today ? 0 : 1;
        const bOver = b.due_date < today ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        return a.due_date.localeCompare(b.due_date);
      });
  }, [payments, personById, search]);

  // Recebidos no dia (payDate)
  const receivedToday = useMemo(() => {
    return payments
      .filter((p) => p.status === "pago" && p.payment_date === payDate)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [payments, payDate]);

  const totalToday = receivedToday.reduce((s, p) => s + Number(p.amount), 0);
  const totalSelected = pending
    .filter((p) => selected.has(p.id))
    .reduce((s, p) => s + Number(p.amount), 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map((p) => p.id)));
  };

  const confirmReceipts = async () => {
    if (selected.size === 0) {
      toast.info("Selecione ao menos uma mensalidade");
      return;
    }
    setSaving(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("payments")
      .update({
        status: "pago",
        payment_date: payDate,
        payment_method: payMethod,
      })
      .in("id", ids);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} recebimento(s) registrados`);
    setSelected(new Set());
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recebimentos do dia"
        description="Selecione mensalidades pendentes e marque como pagas em lote."
      />

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Recebido em {formatDate(payDate)}</div>
          <div className="mt-1 text-2xl font-bold text-success">{brl(totalToday)}</div>
          <div className="text-xs text-muted-foreground mt-1">{receivedToday.length} mensalidade(s)</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Selecionado</div>
          <div className="mt-1 text-2xl font-bold text-primary">{brl(totalSelected)}</div>
          <div className="text-xs text-muted-foreground mt-1">{selected.size} item(ns)</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Pendentes/atrasadas</div>
          <div className="mt-1 text-2xl font-bold">{pending.length}</div>
          <div className="text-xs text-muted-foreground mt-1">aguardando pagamento</div>
        </Card>
      </div>

      {/* Configuração do recebimento */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Data do pagamento</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <Input placeholder="Nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={toggleAll} disabled={pending.length === 0}>
            {selected.size === pending.length && pending.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
          <Button onClick={confirmReceipts} disabled={saving || selected.size === 0} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Marcar {selected.size > 0 ? `${selected.size} ` : ""}como pago
          </Button>
        </div>
      </Card>

      {/* Lista pendentes */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Mensalidades pendentes</span>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma mensalidade pendente. 🎉
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 w-10"></th>
                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold">Categoria</th>
                    <th className="text-left px-4 py-3 font-semibold">Competência</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((pay) => {
                    const person = personById.get(pay.person_id);
                    const checked = selected.has(pay.id);
                    return (
                      <tr
                        key={pay.id}
                        className={
                          "border-t border-border cursor-pointer transition-colors " +
                          (checked ? "bg-primary/5" : "hover:bg-muted/30")
                        }
                        onClick={() => toggle(pay.id)}
                      >
                        <td className="px-4 py-3">
                          <Checkbox checked={checked} onCheckedChange={() => toggle(pay.id)} />
                        </td>
                        <td className="px-4 py-3 font-medium">{person?.full_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {person && CATEGORY_LABELS[person.category]}
                        </td>
                        <td className="px-4 py-3">{competenceLabel(pay.competence)}</td>
                        <td className="px-4 py-3">{formatDate(pay.due_date)}</td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge status={pay.status} dueDate={pay.due_date} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{brl(Number(pay.amount))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-border">
              {pending.map((pay) => {
                const person = personById.get(pay.person_id);
                const checked = selected.has(pay.id);
                return (
                  <button
                    key={pay.id}
                    type="button"
                    onClick={() => toggle(pay.id)}
                    className={
                      "w-full text-left p-4 flex items-start gap-3 transition-colors " +
                      (checked ? "bg-primary/5" : "")
                    }
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(pay.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{person?.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {person && CATEGORY_LABELS[person.category]} · {competenceLabel(pay.competence)}
                          </div>
                        </div>
                        <PaymentStatusBadge status={pay.status} dueDate={pay.due_date} />
                      </div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-muted-foreground">Vence {formatDate(pay.due_date)}</span>
                        <span className="font-bold">{brl(Number(pay.amount))}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Recebidos no dia */}
      {receivedToday.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="font-semibold text-sm">Recebidos em {formatDate(payDate)}</span>
          </div>
          <div className="divide-y divide-border">
            {receivedToday.map((pay) => {
              const person = personById.get(pay.person_id);
              return (
                <div key={pay.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{person?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {person && CATEGORY_LABELS[person.category]} · {competenceLabel(pay.competence)} · {pay.payment_method ?? "—"}
                    </div>
                  </div>
                  <div className="font-bold text-success">{brl(Number(pay.amount))}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
