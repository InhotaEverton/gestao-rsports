import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PeopleManager } from "@/components/PeopleManager";

export const Route = createFileRoute("/metodos")({
  component: () => (
    <ProtectedLayout>
      <PeopleManager category="metodo" title="Métodos" description="Cadastro dos alunos da categoria Métodos." />
    </ProtectedLayout>
  ),
});
