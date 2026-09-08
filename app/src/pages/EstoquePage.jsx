import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function EstoquePage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (company?.id) load();
  }, [company?.id]);

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("products")
      .select("id, sku, name, unit, stock_quantity, min_stock, sale_price, active")
      .eq("company_id", company.id)
      .eq("type", "acabado")
      .eq("active", true)
      .order("name");
    if (e) setError(e.message);
    else setProducts(data ?? []);
    setLoading(false);
  }

  const totalValue = products.reduce((sum, p) => sum + Number(p.stock_quantity ?? 0) * Number(p.sale_price ?? 0), 0);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Estoque — Produto Acabado</h1>
        <p style={styles.subtitle}>
          Todos os produtos acabados cadastrados aparecem aqui. O saldo disponível é atualizado pelos movimentos de estoque.
          Valor em estoque (a preço de venda): <strong style={{ color: "var(--amber)" }}>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : products.length === 0 ? (
        <p style={styles.dim}>Nenhum produto acabado ativo cadastrado.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Produto</th>
                <th style={styles.th}>Disponível</th>
                <th style={styles.th}>Estoque mínimo</th>
                <th style={styles.th}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const qty = Number(p.stock_quantity ?? 0);
                const min = Number(p.min_stock ?? 0);
                const situation = qty === 0 ? "zerado" : min > 0 && qty < min ? "baixo" : "ok";
                return (
                  <tr key={p.id}>
                    <td style={styles.td}>{p.sku}</td>
                    <td style={styles.td}>{p.name}</td>
                    <td style={styles.td}>{qty.toLocaleString("pt-BR")} {p.unit}</td>
                    <td style={styles.td}>{min > 0 ? `${min.toLocaleString("pt-BR")} ${p.unit}` : "—"}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...situationStyle(situation) }}>
                        {situation === "zerado" ? "Zerado" : situation === "baixo" ? "Abaixo do mínimo" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function situationStyle(s) {
  if (s === "zerado") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  if (s === "baixo") return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 760, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 12 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
};
