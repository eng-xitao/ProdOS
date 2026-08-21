import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

/**
 * Quando uma ordem de produção fica pronta, o produto acabado
 * precisa entrar no estoque — sem isso, o sistema "esquece" que
 * o item foi produzido. Esta tela faz esse lançamento, e mantém
 * um histórico de tudo que já foi recebido (nada desaparece).
 */
export default function RecebimentoProducaoPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseByOrder, setWarehouseByOrder] = useState({});
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");

  async function loadOrders() {
    const { data } = await supabase
      .from("production_orders")
      .select("id, code, quantity, product_id, products:product_id (sku, name, unit)")
      .eq("stock_entry_done", false)
      .order("created_at", { ascending: false });
    setOrders((data ?? []).filter((o) => o.product_id));
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("production_orders")
      .select("id, code, quantity, stock_entry_at, products:product_id (sku, name, unit), warehouses:stock_entry_warehouse_id (name)")
      .eq("stock_entry_done", true)
      .order("stock_entry_at", { ascending: false })
      .limit(50);
    setHistory(data ?? []);
  }

  async function loadWarehouses() {
    const { data } = await supabase.from("warehouses").select("id, name").order("name");
    setWarehouses(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadOrders(); loadHistory(); loadWarehouses(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function confirmEntry(order) {
    const warehouseId = warehouseByOrder[order.id];
    if (!warehouseId) {
      setError("Selecione o almoxarifado de destino antes de confirmar.");
      return;
    }
    setError("");
    setProcessing(order.id);

    const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", order.product_id).single();
    const newStock = Number(product?.stock_quantity ?? 0) + Number(order.quantity);
    await supabase.from("products").update({ stock_quantity: newStock }).eq("id", order.product_id);

    const { data: existingLevel } = await supabase
      .from("stock_levels")
      .select("id, quantity")
      .eq("product_id", order.product_id)
      .eq("warehouse_id", warehouseId)
      .maybeSingle();

    if (existingLevel) {
      await supabase.from("stock_levels").update({
        quantity: Number(existingLevel.quantity) + Number(order.quantity),
        updated_at: new Date().toISOString(),
      }).eq("id", existingLevel.id);
    } else {
      await supabase.from("stock_levels").insert({
        company_id: company.id, product_id: order.product_id, warehouse_id: warehouseId, quantity: order.quantity,
      });
    }

    await supabase.from("stock_movements").insert({
      company_id: company.id,
      product_id: order.product_id,
      warehouse_id: warehouseId,
      movement_type: "entrada",
      quantity: order.quantity,
      reference_type: "producao",
      reference_code: order.code,
    });

    await supabase.from("production_orders").update({
      stock_entry_done: true,
      stock_entry_at: new Date().toISOString(),
      stock_entry_warehouse_id: warehouseId,
    }).eq("id", order.id);

    setProcessing("");
    loadOrders();
    loadHistory();
  }

  if (warehouses.length === 0) {
    return (
      <div style={styles.notice}>
        Nenhum almoxarifado cadastrado ainda. Cadastre em{" "}
        <Link to="/almoxarifados" style={styles.link}>Cadastro → Almoxarifados</Link> antes de continuar.
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Recebimento de Produção</h1>
        <p style={styles.subtitle}>
          Ordens de produção que ainda não tiveram o resultado lançado no estoque.
          Escolha o almoxarifado de destino e confirme para dar entrada.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {orders.length === 0 ? (
        <p style={styles.dim}>Nenhuma ordem pendente de recebimento no estoque.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ordem</th>
                <th style={styles.th}>Produto</th>
                <th style={styles.th}>Quantidade</th>
                <th style={styles.th}>Almoxarifado de destino</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={styles.td}>{o.code}</td>
                  <td style={styles.td}>{o.products?.sku} — {o.products?.name}</td>
                  <td style={styles.td}>{o.quantity} {o.products?.unit}</td>
                  <td style={styles.td}>
                    <select
                      style={styles.input}
                      value={warehouseByOrder[o.id] ?? ""}
                      onChange={(e) => setWarehouseByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <button style={styles.confirmBtn} onClick={() => confirmEntry(o)} disabled={processing === o.id} type="button">
                      {processing === o.id ? "Confirmando..." : "Confirmar entrada"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico de recebimentos</h2>
        {history.length === 0 ? (
          <p style={styles.dim}>Nenhum recebimento confirmado ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ordem</th>
                  <th style={styles.th}>Produto</th>
                  <th style={styles.th}>Quantidade</th>
                  <th style={styles.th}>Almoxarifado</th>
                  <th style={styles.th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.id}>
                    <td style={styles.td}>{o.code}</td>
                    <td style={styles.td}>{o.products?.sku} — {o.products?.name}</td>
                    <td style={styles.td}>{o.quantity} {o.products?.unit}</td>
                    <td style={styles.td}>{o.warehouses?.name ?? "—"}</td>
                    <td style={styles.td}>{o.stock_entry_at ? new Date(o.stock_entry_at).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 9px", color: "var(--text)", fontSize: 13,
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  confirmBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};
