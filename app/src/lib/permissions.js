/**
 * Mapa de acesso por papel. `null` significa acesso total (admin).
 * Os nomes precisam bater exatamente com os `label` das seções
 * em components/Layout.jsx.
 *
 * RH foi removido do escopo comercial do ProdOS e passa a ser atendido
 * pelo ProdPersonal. O bloqueio abaixo é intencional para impedir que
 * uma seção RH antiga volte a aparecer no menu mesmo para administradores.
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
export const PLAN_UNRESTRICTED_ROLES = ["master"];

export function hasAccess(role, sectionLabel) {
  // RH não faz mais parte do ProdOS. A gestão de pessoas pertence ao ProdPersonal.
  if (sectionLabel === "RH") return false;
  if (!role || !(role in ROLE_ACCESS)) return false;
  const allowed = ROLE_ACCESS[role];
  if (allowed === null) return true;
  return allowed.includes(sectionLabel);
}
