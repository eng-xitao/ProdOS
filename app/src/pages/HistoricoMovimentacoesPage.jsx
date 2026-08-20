import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const TYPE_LABEL = {
  compra: "Compra",
  producao: "Produção",
  venda: "Venda",
  transferencia: "Transferência",
  ajuste: "Ajuste manual",
};

const TYPE_COLOR = {
  compra: "var(--amber)",
  producao: "var(--green)",
  venda: "var(--red)",
  transferencia: "var(--text-dim)",
  ajuste: "var(--text-dim)",
};

/**
 * Livro de movimentações de estoque — toda entrada e saída,
 * de qualquer origem, fica registrada aqui permanentemente.
 * Este é o lugar pra consultar o histórico completo de um
 * produto ou almoxarifado, sem nada desaparecer.
 */
export default function HistoricoMovimentacoesPage() {
  const { company } = useAuth();
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterProduct, setFilterProduct] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("products").select("id, sku, name").order("name").then(({ data }) => setProducts(data ?? []));
    supabase.from("warehouses").select("id, name").order("name").then(({ data }) => setWarehouses(data ?? []));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("stock_movements")
      .select("id, movement_type, quantity, reference_type, reference_code, notes, created_at, product_id, warehouse_id, products:product_id (sku, name, unit), warehouses:warehouse_id (name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setMovements(data ?? []);
    setLoading(false);
  }

  const filtered = movements.filter((m) =>
    (!filterProduct || m.product_id === filterProduct) &&
    (!filterWarehouse || m.warehouse_id === filterWarehouse) &&
    (!filterType || m.reference_type === filterType)
  );

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Histórico de Movimentações</h1>
        <p style={styles.subtitle}>
          Todas as entradas e saídas de estoque, de qualquer origem — Compra, Produção, Venda,
          Transferência ou Ajuste manual. Nada aqui desaparece, mesmo depois de processado.
        </p>
      </header>

      <div style={styles.filters}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Produto</span>
          <select style={styles.input} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
            <option value="">Todos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Almoxarifado</span>
          <select style={styles.input} value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)}>
            <option value="">Todos</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Origem</span>
          <select style={styles.input} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>Nenhuma movimentação encontrada com esses filtros.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Produto</th>
                <th style={styles.th}>Almoxarifado</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Origem</th>
                <th style={styles.th}>Quantidade</th>
                <th style={styles.th}>Referência</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td style={styles.td}>{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td style={styles.td}>{m.products?.sku} — {m.products?.name}</td>
                  <td style={styles.td}>{m.warehouses?.name ?? "—"}</td>
                  <td style={{ ...styles.td, color: m.movement_type === "entrada" ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                    {m.movement_type === "entrada" ? "Entrada" : "Saída"}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, color: TYPE_COLOR[m.reference_type] }}>{TYPE_LABEL[m.reference_type]}</span>
                  </td>
                  <td style={styles.td}>{m.quantity} {m.products?.unit}</td>
                  <td style={styles.td}>{m.reference_code ?? m.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 660, lineHeight: 1.5 },
  filters: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginTop: 20, marginBottom: 20, maxWidth: 720,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" },
  badge: { fontSize: 12.5, fontWeight: 600 },
};
