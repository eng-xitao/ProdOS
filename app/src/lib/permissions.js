/**
 * Mapa de acesso por papel. `null` significa acesso total (admin).
 * Os nomes precisam bater exatamente com os `label` das seções
 * em components/Layout.jsx.
 */
export const ROLE_ACCESS = {
  master: null,
  admin: null,
  gerente: ["Cadastro", "PCP", "Qualidade", "Comercial", "Compras", "Almoxarifado", "Logística", "Custos", "CRM", "Frotas", "Relatórios"],
  vendas: ["Comercial", "CRM"],
  compras: ["Compras", "Almoxarifado"],
  producao: ["PCP", "Qualidade", "Logística", "Frotas"],
  financeiro: ["Financeiro", "Custos", "Relatórios"],
  rh: ["RH"],
};

export const ROLE_LABEL = {
  master: "Master",
  admin: "Administrador",
  gerente: "Gerente",
  vendas: "Vendas",
  compras: "Compras",
  producao: "Produção",
  financeiro: "Financeiro",
  rh: "RH",
};

// Papéis que enxergam TODAS as seções, e o "master" ainda ignora
// a trava de plano (ver Layout.jsx) — serve pra QA/testes internos.
export const FULL_ACCESS_ROLES = ["master", "admin"];
export const PLAN_UNRESTRICTED_ROLES = ["master"];

export function hasAccess(role, sectionLabel) {
  if (!role || !(role in ROLE_ACCESS)) return false; // papel desconhecido ou não carregado: nega por padrão
  const allowed = ROLE_ACCESS[role];
  if (allowed === null) return true; // master/admin: acesso a todas as seções
  return allowed.includes(sectionLabel);
}
