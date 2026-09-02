/**
 * Mapa de acesso por papel. `null` significa acesso total.
 * RH permanece fora do ProdOS; gestão de pessoas é feita no ProdPersonal.
 */
export const ROLE_ACCESS = {
  master: null,
  admin: null,
  gerente: ["Cadastro", "PCP", "Qualidade", "Comercial", "Compras", "Almoxarifado", "Logística", "Custos", "Financeiro", "Bens/Ativos", "Relatórios"],
  vendas: ["Comercial"],
  compras: ["Compras", "Almoxarifado"],
  producao: ["PCP", "Qualidade", "Logística", "Bens/Ativos"],
  financeiro: ["Financeiro", "Custos", "Relatórios"],
};

export const ROLE_LABEL = {
  master: "Master",
  admin: "Administrador",
  gerente: "Gerente",
  vendas: "Vendas",
  compras: "Compras",
  producao: "Produção",
  financeiro: "Financeiro",
};

export const FULL_ACCESS_ROLES = ["master", "admin"];
export const PLAN_UNRESTRICTED_ROLES = ["master", "admin"];

export function hasAccess(role, sectionLabel) {
  if (sectionLabel === "RH") return false;
  if (!role) return false;
  if (!(role in ROLE_ACCESS)) return false;
  const allowed = ROLE_ACCESS[role];
  if (allowed === null) return true;
  return allowed.includes(sectionLabel);
}
