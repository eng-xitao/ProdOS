import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

const TYPE_LABEL = {
  acabado: "Produto acabado",
  componente: "Componente",
  materia_prima: "Matéria-prima",
  insumo: "Insumo",
  maquina: "Máquina",
};

const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

export default function ProdutosPage() {
  const { company } = useAuth();
  const [units, setUnits] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [printFamily, setPrintFamily] = useState("all");

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from("units_of_measure")
      .select("code, name")
      .order("code")
      .then(({ data }) => setUnits(data ?? []));
  }, [company?.id]);

  const unitOptions = units.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }));

  async function imprimirPorFamilia() {
    if (!company?.id || printing) return;
    setPrinting(true);

    let query = supabase
      .from("products")
      .select("sku,name,type,unit,stock_quantity,min_stock,reorder_point,max_stock,ncm,cfop_padrao,cost,sale_price,lead_time_days,created_at")
      .eq("company_id", company.id)
      .order("name", { ascending: true });

    if (printFamily !== "all") query = query.eq("type", printFamily);

    const { data, error } = await query;
    setPrinting(false);

    if (error) {
      window.alert(`Não foi possível gerar a impressão: ${error.message}`);
      return;
    }

    const rows = data ?? [];
    const selectedLabel = printFamily === "all" ? "Todas as famílias" : TYPE_LABEL[printFamily];

    if (!rows.length) {
      window.alert(`Não há produtos cadastrados para a família selecionada: ${selectedLabel}.`);
      return;
    }

    const grouped = printFamily === "all"
      ? Object.entries(TYPE_LABEL)
          .map(([type, label]) => ({ type, label, rows: rows.filter((r) => r.type === type) }))
          .filter((group) => group.rows.length > 0)
      : [{ type: printFamily, label: TYPE_LABEL[printFamily], rows }];

    const money = (value) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const number = (value) => Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    const esc = (value) => String(value ?? "—")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    const sections = grouped.map((group) => `
      <section class="family">
        <div class="family-title">
          <div><span class="family-kicker">Família</span><h2>${esc(group.label)}</h2></div>
          <span class="count">${group.rows.length} ${group.rows.length === 1 ? "produto" : "produtos"}</span>
        </div>
        <table>
          <thead><tr>
            <th>SKU</th><th>Produto</th><th>Un.</th><th>Estoque</th><th>Mín.</th><th>Ponto pedido</th><th>Custo</th><th>Preço venda</th><th>NCM</th><th>Lead time</th>
          </tr></thead>
          <tbody>${group.rows.map((r) => `<tr>
            <td><strong>${esc(r.sku)}</strong></td>
            <td>${esc(r.name)}</td>
            <td>${esc(r.unit)}</td>
            <td class="num">${number(r.stock_quantity)}</td>
            <td class="num">${number(r.min_stock)}</td>
            <td class="num">${number(r.reorder_point)}</td>
            <td class="num">${money(r.cost)}</td>
            <td class="num">${money(r.sale_price)}</td>
            <td>${esc(r.ncm)}</td>
            <td class="num">${number(r.lead_time_days)} dias</td>
          </tr>`).join("")}</tbody>
        </table>
      </section>
    `).join("");

    const now = new Date().toLocaleString("pt-BR");
    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) {
      window.alert("O navegador bloqueou a janela de impressão. Permita pop-ups para o ProdOS.");
      return;
    }

    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cadastro de Produtos — ${esc(selectedLabel)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin:0; font-family: Arial, Helvetica, sans-serif; color:#1d2430; font-size:9px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1d2430; padding-bottom:10px; margin-bottom:16px; }
        .brand { font-size:20px; font-weight:800; letter-spacing:.08em; }
        .title { font-size:17px; font-weight:700; margin:3px 0; }
        .meta { color:#667085; font-size:9px; }
        .family { break-inside:avoid; margin-bottom:18px; }
        .family-title { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #cfd4dc; padding:0 0 7px; margin-bottom:7px; }
        .family-kicker { display:block; color:#667085; font-size:8px; text-transform:uppercase; letter-spacing:.1em; font-weight:700; }
        h2 { margin:2px 0 0; font-size:13px; }
        .count { font-weight:700; font-size:9px; }
        table { width:100%; border-collapse:collapse; }
        th { text-align:left; font-size:7.5px; text-transform:uppercase; letter-spacing:.04em; color:#667085; background:#f2f4f7; padding:6px 5px; border-bottom:1px solid #cfd4dc; }
        td { padding:6px 5px; border-bottom:1px solid #e4e7ec; vertical-align:top; }
        .num { text-align:right; white-space:nowrap; }
        .footer { margin-top:12px; padding-top:7px; border-top:1px solid #cfd4dc; color:#667085; font-size:8px; display:flex; justify-content:space-between; }
      </style></head><body>
      <header class="header"><div><div class="brand">ProdOS</div><div class="title">Cadastro de Produtos — ${esc(selectedLabel)}</div><div class="meta">Empresa: ${esc(company?.name)} · Emitido em ${esc(now)}</div></div><div class="meta">Documento gerado pelo cadastro de produtos</div></header>
      ${sections}
      <div class="footer"><span>ProdOS — Cadastro de Produtos</span><span>Documento para impressão</span></div>
      <script>window.onload=function(){window.focus();window.print();}</script>
      </body></html>`);
    win.document.close();
  }

  return (
    <div>
      <div style={styles.toolbar} className="no-print">
        <label style={styles.familyControl}>
          <span style={styles.familyLabel}>Família para impressão</span>
          <select value={printFamily} onChange={(e) => setPrintFamily(e.target.value)} style={styles.familySelect} disabled={printing}>
            <option value="all">Todas as famílias</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="button" style={styles.printBtn} onClick={imprimirPorFamilia} disabled={printing}>
          {printing ? "Preparando impressão..." : "🖨 Imprimir"}
        </button>
      </div>
      <ModulePage
        table="products"
        title="Produtos"
        subtitle="Cadastro de produtos acabados, componentes, matérias-primas, insumos e máquinas"
        emptyLabel="Nenhum produto cadastrado ainda."
        fields={[
          { key: "sku", label: "SKU", placeholder: "Ex: PRD-001", required: true },
          { key: "name", label: "Nome", placeholder: "Ex: Portão basculante 3x2m", required: true },
          { key: "type", label: "Classe", type: "select", required: true, options: TYPE_OPTIONS },
          unitOptions.length > 0
            ? { key: "unit", label: "Unidade", type: "select", options: unitOptions, required: true }
            : { key: "unit", label: "Unidade", placeholder: "Cadastre em Cadastro → Unidades de Medida" },
          { key: "stock_quantity", label: "Estoque atual", type: "number" },
          { key: "min_stock", label: "Estoque mínimo", type: "number" },
          { key: "reorder_point", label: "Ponto de pedido", type: "number", placeholder: "Se vazio, usa o estoque mínimo" },
          { key: "max_stock", label: "Estoque máximo", type: "number", placeholder: "Usado pra calcular quanto sugerir comprar" },
          { key: "ncm", label: "NCM (fiscal)", placeholder: "Ex: 73181500 — necessário pra emitir NF-e" },
          { key: "cfop_padrao", label: "CFOP padrão (venda)", placeholder: "5102" },
          { key: "cost", label: "Custo", type: "currency" },
          { key: "sale_price", label: "Preço de venda", type: "currency" },
          { key: "lead_time_days", label: "Lead time (dias)", type: "number" },
        ]}
      />
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  familyControl: { display: "flex", flexDirection: "column", gap: 4 },
  familyLabel: { fontSize: 11, fontWeight: 600, color: "var(--text-dim)" },
  familySelect: {
    minWidth: 210,
    background: "var(--surface, #fff)",
    color: "var(--text, #1d2430)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  printBtn: {
    background: "transparent",
    color: "var(--text-dim)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 16px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
};
