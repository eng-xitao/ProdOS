/**
 * Trava de exclusão compartilhada por todo o sistema. Se a empresa
 * configurou um PIN de exclusão (Configurações > Empresa), pede o
 * PIN antes de apagar qualquer coisa — senão, cai numa confirmação
 * simples. Assim, a empresa cliente decide o nível de proteção que
 * quer, e só uma pessoa responsável (quem sabe o PIN) consegue excluir.
 */
export async function confirmDelete(company, itemLabel = "este registro") {
  if (company?.delete_pin) {
    const entered = window.prompt(
      `Excluir ${itemLabel} exige o PIN de exclusão da empresa. Digite o PIN pra confirmar:`
    );
    if (entered === null) return false; // cancelou
    if (entered !== company.delete_pin) {
      window.alert("PIN incorreto. A exclusão foi cancelada.");
      return false;
    }
    return true;
  }
  return window.confirm(`Tem certeza que deseja excluir ${itemLabel}? Essa ação não pode ser desfeita.`);
}
