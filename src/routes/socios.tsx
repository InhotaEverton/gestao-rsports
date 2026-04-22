import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { PeopleManager } from "@/components/PeopleManager";

export const Route = createFileRoute("/socios")({
  component: () => (
    <ProtectedLayout>
      <PeopleManager category="socio" title="Sócios" description="Cadastro dos sócios contribuintes." />
    </ProtectedLayout>
  ),
});
