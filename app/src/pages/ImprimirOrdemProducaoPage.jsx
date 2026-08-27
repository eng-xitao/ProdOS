import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { openPrintWindow, brandHeader, formatDate } from "../lib/printDocument";

/**
 * Imprime o documento formal da Ordem de Produção: dados do produto,
 * lista de materiais (BOM) e o histórico real de apontamentos —
 * colaborador, etapa, data/hora de início e fim, produzido/refugado
 * e observações — igual à tela de Apontamento de Produção.
 */
export default function ImprimirOrdemProducaoPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [stages, setStages] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from("production_orders")
      .select("id, code, quantity, due_date, created_at, stage_id, product_id, products:product_id (sku, name, unit)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data ?? []));
    supabase.from("production_stages").select("id, name").order("sort_order").then(({ data }) => setStages(data ?? []));
  }, [company?.id]);

  function combineDateTime(dateStr, timeStr) {
    if (!dateStr) return "—";
    const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
    if (!timeStr) return dateLabel;
    return `${dateLabel} ${timeStr.slice(0, 5)}`;
  }

  async function printOrder() {
    setError("");
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const [{ data: components }, { data: logs }] = await Promise.all([
      supabase
        .from("product_components")
        .select("quantity, products:component_id (sku, name, unit)")
        .eq("parent_product_id", order.product_id),
      supabase
        .from("production_time_logs")
        .select("log_date, start_time, end_time, hours, quantity_produced, quantity_scrapped, notes, employees:employee_id (full_name), production_stages:stage_id (name)")
        .eq("production_order_id", order.id)
        .order("log_date", { ascending: true }),
    ]);

    const stageName = stages.find((s) => s.id === order.stage_id)?.name ?? "—";

    const materialsRows = (components ?? []).map((c) => {
      const totalQty = Number(c.quantity) * Number(order.quantity);
      return `<tr>
        <td>${c.products?.sku ?? ""}</td>
        <td>${c.products?.name ?? ""}</td>
        <td>${c.quantity} ${c.products?.unit ?? ""} / unidade</td>
        <td>${totalQty.toLocaleString("pt-BR")} ${c.products?.unit ?? ""}</td>
      </tr>`;
    }).join("");

    const apontamentoRows = (logs ?? []).map((l) => `
      <tr>
        <td>${l.employees?.full_name ?? "—"}</td>
        <td>${l.production_stages?.name ?? "—"}</td>
        <td>${combineDateTime(l.log_date, l.start_time)}</td>
        <td>${combineDateTime(l.log_date, l.end_time)}</td>
        <td>${l.hours ?? "—"}</td>
        <td>${l.quantity_produced ?? 0}</td>
        <td>${l.quantity_scrapped ?? 0}</td>
        <td>${l.notes ?? "—"}</td>
      </tr>
    `).join("");

    const html = `
      ${brandHeader(company, "ORDEM DE PRODUÇÃO", [
        ["O.P. Nº", order.code],
        ["Emitida em", formatDate(order.created_at)],
        ["Prazo", formatDate(order.due_date)],
      ])}
      <div class="section-title">Produto</div>
      <div class="info-grid">
        <div><strong>Produto:</strong> ${order.products?.sku ?? ""} — ${order.products?.name ?? ""}</div>
        <div><strong>Quantidade:</strong> ${order.quantity} ${order.products?.unit ?? ""}</div>
        <div><strong>Etapa atual:</strong> ${stageName}</div>
      </div>

      ${materialsRows ? `
        <div class="section-title">Lista de Materiais (Estrutura do Produto)</div>
        <table>
          <thead><tr><th>SKU</th><th>Componente</th><th>Qtd. por unidade</th><th>Qtd. total</th></tr></thead>
          <tbody>${materialsRows}</tbody>
        </table>
      ` : `<div class="notes-box">Este produto ainda não tem estrutura (BOM) cadastrada.</div>`}

      <div class="section-title">Apontamentos de Produção</div>
      ${apontamentoRows ? `
        <table>
          <thead><tr><th>Colaborador</th><th>Etapa</th><th>Início</th><th>Fim</th><th>Horas</th><th>Produzido</th><th>Refugado</th><th>Observações</th></tr></thead>
          <tbody>${apontamentoRows}</tbody>
        </table>
      ` : `<div class="notes-box">Nenhum apontamento registrado ainda para esta ordem.</div>`}

      <div class="notes-box"><strong>Observações gerais:</strong></div>

      <div class="signatures">
        <div class="signature-line">Responsável pela Produção</div>
        <div class="signature-line">Supervisor</div>
      </div>
    `;

    openPrintWindow(`Ordem de Produção ${order.code}`, html);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Imprimir Ordem de Produção</h1>
        <p style={styles.subtitle}>Escolha uma ordem para gerar o documento formal, com a lista de materiais e o histórico de apontamentos.</p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.row}>
        <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">Selecione uma ordem...</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.products?.sku}</option>)}
        </select>
        <button style={styles.printBtn} onClick={printOrder} disabled={!orderId} type="button">🖨 Imprimir</button>
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 560, lineHeight: 1.5 },
  row: { display: "flex", gap: 10, maxWidth: 560, marginTop: 20 },
  input: {
    flex: 1, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  printBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none",
    borderRadius: "var(--radius)", padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 12, maxWidth: 560,
  },
};
