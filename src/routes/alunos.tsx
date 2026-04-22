import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PeopleManager } from "@/components/PeopleManager";

export const Route = createFileRoute("/alunos")({
  component: () => (
    <ProtectedLayout>
      <PeopleManager category="aluno" title="Alunos" description="Cadastro completo dos alunos da escolinha." />
    </ProtectedLayout>
  ),
});
