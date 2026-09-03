/**
 * Acesso por papel aos processos do ProdOS.
 * Gestao de pessoas pertence ao ProdPersonal e nao ao ProdOS.
 */
export const ROLE_ACCESS = {
  master: null,
  admin: null,
  gerente: ["CRM", "Comercial", "Estoque", "Compras", "PCP", "Producao", "Logistica", "Frotas", "Fiscal", "Financeiro", "Gestao", "Cadastros"],
  vendas: ["CRM", "Comercial"],
  compras: ["Estoque", "Compras", "Cadastros"],
  producao: ["Estoque", "PCP", "Producao", "Logistica", "Frotas", "Cadastros"],
  financeiro: ["Financeiro", "Gestao", "Cadastros"],
};

export const ROLE_LABEL = {
  master: "Master",
  admin: "Administrador",
  gerente: "Gerente",
  vendas: "Vendas",
  compras: "Compras",
  producao: "Producao",
  financeiro: "Financeiro",
};

export const FULL_ACCESS_ROLES = ["master", "admin"];
export const PLAN_UNRESTRICTED_ROLES = ["master", "admin"];

export function hasAccess(role, sectionLabel) {
  if (sectionLabel === "RH") return false;
  if (!role || !(role in ROLE_ACCESS)) return false;
  const allowed = ROLE_ACCESS[role];
  return allowed === null || allowed.includes(sectionLabel);
}
