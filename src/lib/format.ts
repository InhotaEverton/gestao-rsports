export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const calcAge = (birth: string): number => {
  const b = new Date(birth + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

export const formatDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return dt.toLocaleDateString("pt-BR");
};

export const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const isBirthdayToday = (birth: string) => {
  const b = new Date(birth + "T00:00:00");
  const t = new Date();
  return b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
};

export const competenceLabel = (c: string) => {
  // c = '2025-04'
  const [y, m] = c.split("-");
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[Number(m) - 1]}/${y}`;
};
