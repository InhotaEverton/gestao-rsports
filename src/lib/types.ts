export type PersonCategory = "aluno" | "socio" | "metodo";
export type PersonStatus = "ativo" | "inativo";
export type PaymentStatus = "pendente" | "pago" | "atrasado";

export interface Person {
  id: string;
  category: PersonCategory;
  full_name: string;
  birth_date: string;
  guardian_name: string | null;
  phone: string | null;
  address: string | null;
  enrollment_date: string;
  due_day: number;
  notes: string | null;
  status: PersonStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  person_id: string;
  competence: string;
  amount: number;
  due_date: string;
  status: PaymentStatus;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<PersonCategory, string> = {
  aluno: "Aluno",
  socio: "Sócio",
  metodo: "Método",
};

export const MONTHLY_FEE = 120;
