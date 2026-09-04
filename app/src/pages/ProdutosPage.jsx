import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const CLASS_OPTIONS = [
  { value: "acabado", label: "Produto acabado" },
  { value: "materia_prima", label: "Matéria-prima" },
  { value: "insumo", label: "Insumo" },
  { value: "componente", label: "Componente / semiacabado" },
];
const UNITS_FALLBACK = ["un", "kg", "g", "m", "cm", "l", "ml"];

const money = (v) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ProdutosPage() {
  const { company } = useAuth();
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "acabado", unit: "un", cfop_padrao: "5102", sale_price_source: "manual" });

  const isFinished = form.type === "acabado";
  const materialLabel = form.type === "componente" ? "Componente / semiacabado" : form.type === "materia_prima" ? "Matéria-prima" : "Insumo";

  async function load() {
    if (!company?.id) return;
    const [{ data, error: e1 }, { data: u }, { data: l, error: e3 }] = await Promise.all([
      supabase.from("products").select("*").eq("company_id", company.id).order("created_at", { ascending: false }),
      supabase.from("units_of_measure").select("code,name").order("code"),
      supabase.from("warehouse_locations").select("id,code,aisle,shelf,level,warehouses!inner(name,company_id)").eq("warehouses.company_id", company.id).order("code"),
    ]);
    if (e1) setError(e1.message);
    if (e3) setError(e3.message);
    setRows(data ?? []);
    setUnits(u ?? []);
    setLocations(l ?? []);
  }

  useEffect(() => { load(); }, [company?.id]);

  const unitOptions = useMemo(() => units.length ? units.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` })) : UNITS_FALLBACK.map((u) => ({ value: u, label: u.toUpperCase() })), [units]);
  const locationOptions = useMemo(() => locations.map((l) => ({ value: l.id, label: [l.code, l.aisle && `Rua ${l.aisle}`, l.shelf && `Prat. ${l.shelf}`, l.level && `Nível ${l.level}`].filter(Boolean).join(" · ") })), [locations]);

  function update(key, value) { setForm((f) => ({ ...f, [key]: value })); }
  function startNew() {
    setError("");
    setForm({ type: "acabado", unit: "un", cfop_padrao: "5102", sale_price_source: "manual" });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!company?.id) return setError("Não foi possível identificar a empresa.");
    setSaving(true); setError("");
    const payload = {
      company_id: company.id,
      sku: form.sku?.trim(), name: form.name?.trim(), type: form.type, unit: form.unit || "un",
      stock_quantity: Number(form.stock_quantity || 0), min_stock: Number(form.min_stock || 0),
      reorder_point: form.reorder_point === "" ? null : Number(form.reorder_point),
      max_stock: form.max_stock === "" ? null : Number(form.max_stock),
      ncm: form.ncm?.trim() || null, cfop_padrao: form.cfop_padrao?.trim() || null,
      sale_price: isFinished ? Number(form.sale_price || 0) : 0,
      sale_price_source: isFinished ? "manual" : "nao_aplicavel",
      sale_margin_percent: isFinished && form.sale_margin_percent !== "" ? Number(form.sale_margin_percent) : null,
      lead_time_days: Number(form.lead_time_days || 0),
      default_location_id: form.default_location_id || null,
      stock_destination: isFinished ? "produto_acabado" : "almoxarifado",
      cost_source: "automatico",
      active: true,
    };
    if (!payload.sku || !payload.name) { setError("Informe SKU e Nome."); setSaving(false); return; }
    const { error: e } = await supabase.from("products").insert(payload);
    if (e) setError(e.message); else { setOpen(false); await load(); }
    setSaving(false);
  }

  async function refreshCost(id) {
    const { error: e } = await supabase.rpc("refresh_product_cost", { p_product_id: id });
    if (e) setError(e.message); else await load();
  }

  return (
    <div>
      <header style={styles.header}>
        <div><h1 style={styles.title}>Produtos</h1><p style={styles.subtitle}>Um único cadastro para produtos acabados e materiais, com regras automáticas de estoque, custo e integração com a BOM.</p></div>
        <button style={styles.primary} onClick={startNew}>+ Novo</button>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {open && <form onSubmit={submit} style={styles.card} className="no-print">
        <div style={styles.formTitle}>Novo produto</div>
        <div style={styles.typeSwitch}>
          <button type="button" style={{ ...styles.typeBtn, ...(isFinished ? styles.typeActive : {}) }} onClick={() => update("type", "acabado")}>◆ Produto Acabado</button>
          <button type="button" style={{ ...styles.typeBtn, ...(!isFinished ? styles.typeActive : {}) }} onClick={() => update("type", "materia_prima")}>▰ Materiais</button>
        </div>
        <div style={styles.helper}>{isFinished ? "Produto final fabricado e normalmente vendido. A BOM define sua receita/estrutura." : "Materiais usados pela produção. Escolha a classe detalhada abaixo."}</div>
        <div style={styles.grid}>
          <Field label="SKU" required><input style={styles.input} value={form.sku ?? ""} onChange={(e) => update("sku", e.target.value)} placeholder={isFinished ? "PA-000001" : "MP-000001"} required /></Field>
          <Field label="Nome" required><input style={styles.input} value={form.name ?? ""} onChange={(e) => update("name", e.target.value)} placeholder={isFinished ? "Borracha de Porta Tribulbo" : "EPDM Granulado"} required /></Field>
          <Field label="Classe" required><select style={styles.input} value={form.type} onChange={(e) => update("type", e.target.value)}>{CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Unidade" required><select style={styles.input} value={form.unit ?? "un"} onChange={(e) => update("unit", e.target.value)}>{unitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Estoque atual" help="O saldo deve ser alterado por recebimento, produção, venda ou movimentação; não é um preço/cadastro manual."><input style={styles.input} type="number" min="0" step="any" value={form.stock_quantity ?? 0} onChange={(e) => update("stock_quantity", e.target.value)} /></Field>
          <Field label="Estoque mínimo"><input style={styles.input} type="number" min="0" step="any" value={form.min_stock ?? 0} onChange={(e) => update("min_stock", e.target.value)} /></Field>
          <Field label="Ponto de pedido"><input style={styles.input} type="number" min="0" step="any" value={form.reorder_point ?? ""} onChange={(e) => update("reorder_point", e.target.value)} /></Field>
          <Field label="Estoque máximo"><input style={styles.input} type="number" min="0" step="any" value={form.max_stock ?? ""} onChange={(e) => update("max_stock", e.target.value)} /></Field>
          <Field label="NCM"><input style={styles.input} value={form.ncm ?? ""} onChange={(e) => update("ncm", e.target.value)} placeholder="00000000" /></Field>
          <Field label="CFOP padrão"><input style={styles.input} value={form.cfop_padrao ?? "5102"} onChange={(e) => update("cfop_padrao", e.target.value)} /></Field>
          <Field label="Lead time (dias)"><input style={styles.input} type="number" min="0" step="1" value={form.lead_time_days ?? 0} onChange={(e) => update("lead_time_days", e.target.value)} /></Field>
          <Field label="Endereço padrão no Almoxarifado" help="Endereço físico padrão para localização. A movimentação continua sendo controlada pelo estoque."><select style={styles.input} value={form.default_location_id ?? ""} onChange={(e) => update("default_location_id", e.target.value)}><option value="">Sem endereço definido</option>{locationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <div style={styles.readonlyBox}><span>Custo</span><strong>Automático</strong><small>{isFinished ? "Calculado pela BOM e custos dos componentes." : "Calculado pelo custo médio das compras recebidas."}</small></div>
          {isFinished && <>
            <Field label="Preço de venda" help="Valor comercial. Não altera o custo. Pode evoluir para tabela de preços/margem por cliente ou canal."><input style={styles.input} type="number" min="0" step="0.01" value={form.sale_price ?? 0} onChange={(e) => update("sale_price", e.target.value)} /></Field>
            <Field label="Margem desejada (%) — opcional"><input style={styles.input} type="number" min="0" max="99.99" step="0.01" value={form.sale_margin_percent ?? ""} onChange={(e) => update("sale_margin_percent", e.target.value)} placeholder="Ex.: 35" /></Field>
          </>}
        </div>
        <div style={styles.destination}><strong>Destino automático:</strong> {isFinished ? "Estoque de Produto Acabado" : `Almoxarifado (${materialLabel})`}</div>
        <div style={styles.actions}><button type="button" style={styles.secondary} onClick={() => setOpen(false)}>Cancelar</button><button type="submit" style={styles.primary} disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</button></div>
      </form>}

      <section style={styles.card}>
        <div style={styles.listTitle}>Itens cadastrados <span>{rows.length}</span></div>
        {rows.length === 0 ? <div style={styles.empty}>Nenhum produto cadastrado ainda.</div> : <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th>SKU</th><th>Produto</th><th>Classe</th><th>Un.</th><th>Estoque</th><th>Custo</th><th>Preço venda</th><th>Endereço</th><th></th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.sku}</strong></td><td>{r.name}</td><td>{CLASS_OPTIONS.find((o) => o.value === r.type)?.label ?? r.type}</td><td>{r.unit}</td><td>{Number(r.stock_quantity ?? 0).toLocaleString("pt-BR")}</td><td>{r.cost_source === "automatico" ? <><strong>{money(r.cost)}</strong><small style={styles.auto}> automático</small></> : money(r.cost)}</td><td>{r.type === "acabado" ? money(r.sale_price) : "—"}</td><td>{locationOptions.find((l) => l.value === r.default_location_id)?.label ?? "—"}</td><td><button style={styles.refresh} onClick={() => refreshCost(r.id)}>Atualizar custo</button></td></tr>)}</tbody></table></div>}
      </section>
      <div style={styles.note}><strong>Regra:</strong> o cadastro é único. A classificação detalhada continua no banco para que Compras, Estoque, MRP, PCP, Produção, Fiscal e BOM saibam exatamente que tipo de item estão tratando. A <strong>Estrutura do Produto (BOM)</strong> continua sendo a tela própria para montar a receita.</div>
    </div>
  );
}

function Field({ label, help, required, children }) { return <label style={styles.field}><span style={styles.label}>{label}{required ? " *" : ""}</span>{children}{help && <small style={styles.help}>{help}</small>}</label>; }

const styles = {
  header:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18,flexWrap:"wrap"},
  title:{fontFamily:"var(--font-display)",fontSize:22,margin:0}, subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:820,lineHeight:1.55},
  primary:{background:"var(--blue,#2563EB)",color:"white",border:0,borderRadius:"var(--radius)",padding:"10px 16px",fontWeight:700,cursor:"pointer"}, secondary:{background:"var(--panel-2)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"10px 16px",fontWeight:600,cursor:"pointer"},
  card:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:16,marginBottom:16}, formTitle:{fontSize:16,fontWeight:800,marginBottom:12},
  typeSwitch:{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}, typeBtn:{background:"var(--panel-2)",border:"1px solid var(--line)",borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer",color:"var(--text)"}, typeActive:{border:"2px solid var(--blue,#2563EB)",padding:"9px 13px"}, helper:{fontSize:12,color:"var(--text-dim)",marginBottom:14},
  grid:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}, field:{display:"flex",flexDirection:"column",gap:5}, label:{fontSize:12,fontWeight:700}, input:{width:"100%",boxSizing:"border-box",background:"var(--field,#F7F9FB)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"10px 11px",fontSize:13}, help:{fontSize:10.5,color:"var(--text-dim)",lineHeight:1.35},
  readonlyBox:{border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:10,background:"var(--panel-2)",display:"flex",flexDirection:"column",gap:3}, destination:{marginTop:14,padding:"10px 12px",border:"1px solid var(--line)",borderRadius:8,color:"var(--text-dim)",fontSize:12}, actions:{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}, error:{marginBottom:14,padding:11,border:"1px solid #e4b5b5",background:"#fff5f5",borderRadius:8,color:"#9b2c2c",fontSize:12},
  listTitle:{fontSize:14,fontWeight:800,marginBottom:12}, listTitleSpan:{}, empty:{padding:24,textAlign:"center",color:"var(--text-dim)"}, tableWrap:{overflowX:"auto"}, table:{width:"100%",borderCollapse:"collapse",fontSize:12}, auto:{color:"var(--green,#16835A)",fontSize:9}, refresh:{background:"transparent",border:"1px solid var(--line)",borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer"}, note:{fontSize:12,color:"var(--text-dim)",lineHeight:1.5,padding:"10px 12px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)"}
};