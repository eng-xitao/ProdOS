/**
 * Mapa de acesso por papel. `null` significa acesso total (admin).
 * Os nomes precisam bater exatamente com os `label` das seções
 * em components/Layout.jsx.
 */
export const ROLE_ACCESS = {
  admin: null,
  gerente: ["Cadastro", "PCP", "Comercial", "Compras", "Logística", "Custos", "CRM", "Frotas", "Relatórios"],
  vendas: ["Comercial", "CRM"],
  compras: ["Compras"],
  producao: ["PCP", "Logística", "Frotas"],
  financeiro: ["Financeiro", "Custos", "Relatórios"],
  rh: ["RH"],
};

export const ROLE_LABEL = {
  admin: "Administrador",
  gerente: "Gerente",
  vendas: "Vendas",
  compras: "Compras",
  producao: "Produção",
  financeiro: "Financeiro",
  rh: "RH",
};

export function hasAccess(role, sectionLabel) {
  if (role === "admin") return true;
  const allowed = ROLE_ACCESS[role];
  if (!allowed) return false; // papel desconhecido ou não carregado: nega por padrão
  return allowed.includes(sectionLabel);
}
