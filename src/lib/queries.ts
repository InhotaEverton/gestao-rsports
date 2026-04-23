import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Payment, Person, PersonCategory } from "@/lib/types";

export const queryKeys = {
  people: ["people"] as const,
  peopleByCategory: (cat: PersonCategory) => ["people", cat] as const,
  payments: ["payments"] as const,
  paymentsByPerson: (id: string) => ["payments", "person", id] as const,
};

export function usePeople() {
  return useQuery({
    queryKey: queryKeys.people,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
    staleTime: 1000 * 60, // 1 min
  });
}

export function usePeopleByCategory(category: PersonCategory) {
  return useQuery({
    queryKey: queryKeys.peopleByCategory(category),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("category", category)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
    staleTime: 1000 * 60,
  });
}

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
    staleTime: 1000 * 60,
  });
}

export function usePaymentsOfPerson(personId: string | null) {
  return useQuery({
    queryKey: personId ? queryKeys.paymentsByPerson(personId) : ["payments", "person", "none"],
    queryFn: async () => {
      if (!personId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("person_id", personId)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
    enabled: !!personId,
    staleTime: 1000 * 30,
  });
}

/**
 * Invalida caches relacionados. Usar após mutações.
 */
export function useInvalidateData() {
  const qc = useQueryClient();
  return {
    invalidatePeople: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
    },
    invalidatePayments: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    invalidateAll: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  };
}

/**
 * Subscreve em mudanças realtime do Supabase e invalida caches automaticamente.
 * Garante consistência entre abas/telas/usuários.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("rsports-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        () => qc.invalidateQueries({ queryKey: ["people"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => qc.invalidateQueries({ queryKey: ["payments"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
