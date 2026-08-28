import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Person, PersonCategory, PersonStatus } from "@/lib/types";
import { CATEGORY_LABELS, MONTHLY_FEE } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { calcAge, formatDate, brl, competenceLabel, todayISO } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, Receipt, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { usePeopleByCategory, usePaymentsOfPerson, useInvalidateData } from "@/lib/queries";
import { PaginationBar, usePagination } from "@/components/Pagination";
import { TableSkeleton } from "@/components/Skeletons";

interface Props {
  category: PersonCategory;
  title: string;
  description: string;
}

const emptyForm = (cat: PersonCategory) => ({
  full_name: "",
  birth_date: "",
  guardian_name: "",
  phone: "",
  address: "",
  enrollment_date: todayISO(),
  due_day: 10,
  notes: "",
  status: "ativo" as PersonStatus,
  category: cat,
});

export function PeopleManager({ category, title, description }: Props) {
  const { data: people = [], isLoading: loading } = usePeopleByCategory(category);
  const { invalidatePeople, invalidatePayments } = useInvalidateData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | PersonStatus>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState(emptyForm(category));
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paymentsOf, setPaymentsOf] = useState<Person | null>(null);

  const { data: personPayments = [], isLoading: loadingPayments } = usePaymentsOfPerson(
    paymentsOf?.id ?? null,
  );

  const showsGuardian = category !== "socio";

  useEffect(() => {
    setForm(emptyForm(category));
  }, [category]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          (p.guardian_name?.toLowerCase().includes(q) ?? false) ||
          (p.phone?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [people, search, statusFilter]);

  const pag = usePagination(filtered, 20);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(category));
    setDialogOpen(true);
  };

  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      birth_date: p.birth_date,
      guardian_name: p.guardian_name ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
      enrollment_date: p.enrollment_date,
      due_day: p.due_day,
      notes: p.notes ?? "",
      status: p.status,
      category: p.category,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.birth_date) {
      toast.error("Preencha nome e data de nascimento");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      full_name: form.full_name.trim(),
      guardian_name: form.guardian_name.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      due_day: Number(form.due_day) || 10,
    };
    if (editing) {
      const { error } = await supabase.from("people").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Cadastro atualizado");
    } else {
      const { error } = await supabase.from("people").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Cadastro criado");
    }
    setSaving(false);
    setDialogOpen(false);
    invalidatePeople();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("people").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else toast.success("Cadastro excluído");
    setDeleteId(null);
    invalidatePeople();
    invalidatePayments();
  };

  const openPayments = (p: Person) => {
    setPaymentsOf(p);
  };

  const generateMonthly = async () => {
    if (!paymentsOf) return;
    const now = new Date();
    const competence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const exists = personPayments.some((p) => p.competence === competence);
    if (exists) {
      toast.info("Mensalidade desse mês já existe");
      return;
    }
    const due = new Date(now.getFullYear(), now.getMonth(), Math.min(paymentsOf.due_day, 28));
    const due_date = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    const { error } = await supabase.from("payments").insert({
      person_id: paymentsOf.id,
      competence,
      amount: MONTHLY_FEE,
      due_date,
      status: "pendente",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Mensalidade gerada");
      invalidatePayments();
    }
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "pago", payment_date: todayISO(), payment_method: "Dinheiro" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pagamento registrado");
      invalidatePayments();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, responsável, telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo {CATEGORY_LABELS[category]}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={showsGuardian ? 7 : 6} />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold">Idade</th>
                    {showsGuardian && <th className="text-left px-4 py-3 font-semibold">Responsável</th>}
                    <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pag.pageItems.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.full_name}</td>
                      <td className="px-4 py-3">{calcAge(p.birth_date)} anos</td>
                      {showsGuardian && <td className="px-4 py-3 text-muted-foreground">{p.guardian_name ?? "—"}</td>}
                      <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                      <td className="px-4 py-3">Dia {p.due_day}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openPayments(p)} title="Mensalidades">
                            <Receipt className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {pag.pageItems.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground">{calcAge(p.birth_date)} anos · venc. dia {p.due_day}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.phone && <div className="text-sm text-muted-foreground">📞 {p.phone}</div>}
                  {showsGuardian && p.guardian_name && (
                    <div className="text-sm text-muted-foreground">Resp.: {p.guardian_name}</div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openPayments(p)} className="gap-1">
                      <Receipt className="h-3.5 w-3.5" />Mensalidades
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <PaginationBar
              page={pag.page}
              totalPages={pag.totalPages}
              from={pag.from}
              to={pag.to}
              total={pag.total}
              onPage={pag.setPage}
            />
          </>
        )}
      </Card>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Novo"} {CATEGORY_LABELS[category]}
            </DialogTitle>
            <DialogDescription>
              Mensalidade fixa de {brl(MONTHLY_FEE)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label>Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento *</Label>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  required
                />
                {form.birth_date && (
                  <p className="text-xs text-muted-foreground">{calcAge(form.birth_date)} anos</p>
                )}
              </div>
              {showsGuardian && (
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className={showsGuardian ? "sm:col-span-2 space-y-2" : "space-y-2"}>
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{category === "socio" ? "Data de entrada" : "Data de matrícula"} *</Label>
                <Input
                  type="date"
                  value={form.enrollment_date}
                  onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento *</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.due_day}
                  onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PersonStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensalidades vinculadas também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payments dialog */}
      <Dialog open={!!paymentsOf} onOpenChange={(o) => !o && setPaymentsOf(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mensalidades — {paymentsOf?.full_name}</DialogTitle>
            <DialogDescription>Histórico financeiro do cadastro.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={generateMonthly} className="gap-2">
              <Plus className="h-4 w-4" /> Gerar mês atual
            </Button>
          </div>
          {loadingPayments ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : personPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma mensalidade gerada.</p>
          ) : (
            <div className="space-y-2">
              {personPayments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <div className="font-medium">{competenceLabel(pay.competence)}</div>
                    <div className="text-xs text-muted-foreground">
                      Vence em {formatDate(pay.due_date)} · {brl(Number(pay.amount))}
                    </div>
                    {pay.payment_date && (
                      <div className="text-xs text-success">Pago em {formatDate(pay.payment_date)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentStatusBadge status={pay.status} dueDate={pay.due_date} />
                    {pay.status !== "pago" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(pay.id)} className="gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: PersonStatus }) {
  return (
    <Badge variant={status === "ativo" ? "default" : "secondary"} className={status === "ativo" ? "bg-success text-success-foreground hover:bg-success" : ""}>
      {status === "ativo" ? "Ativo" : "Inativo"}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, dueDate }: { status: string; dueDate: string }) {
  const isOverdue = status === "pendente" && dueDate < todayISO();
  const effective = isOverdue ? "atrasado" : status;
  const map: Record<string, { label: string; className: string }> = {
    pago: { label: "Pago", className: "bg-success text-success-foreground" },
    pendente: { label: "Pendente", className: "bg-warning text-warning-foreground" },
    atrasado: { label: "Atrasado", className: "bg-destructive text-destructive-foreground" },
  };
  const it = map[effective] ?? map.pendente;
  return <Badge className={it.className + " hover:opacity-90"}>{it.label}</Badge>;
}
