/**
 * Botão "Imprimir" padrão pros relatórios — o CSS de impressão
 * global já esconde botões e menu na hora de imprimir, então esse
 * botão nunca aparece no papel, só na tela.
 */
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} type="button" style={styles.btn}>
      🖨️ Imprimir
    </button>
  );
}

function rangeLabel(range) {
  if (!range || (!range.from && !range.to)) return "Período: todo o histórico";
  const from = range.from ? new Date(range.from + "T00:00:00").toLocaleDateString("pt-BR") : "início";
  const to = range.to ? new Date(range.to + "T00:00:00").toLocaleDateString("pt-BR") : "hoje";
  return `Período: ${from} até ${to}`;
}

export { rangeLabel };

const styles = {
  btn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 16px", fontSize: 12.5, fontWeight: 700, color: "var(--text)", cursor: "pointer",
  },
};
