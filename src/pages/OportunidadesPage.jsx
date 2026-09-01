import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import CurrencyInput from "../components/CurrencyInput";
import { openPrintWindow, brandHeader, currency, formatDate } from "../lib/printDocument";

const INTERACTION_LABEL = { ligacao: "Ligação", reuniao: "Reunião", email: "E-mail", nota: "Nota" };
const PRIORITIES = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const SOURCES = ["Prospecção ativa", "Indicação", "Site", "Cliente atual", "Evento/Feira", "Campanha", "Outro"];

export default function OportunidadesPage() {
  const { company, profile } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newValue, setNewValue] = useState(0);
  const [newDate, setNewDate] = useState("");
  const [newSource, setNewSource] = useState("Prospecção ativa");
  const [newPriority, setNewPriority] = useState("media");
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newItems, setNewItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  async function loadAll() {
    const [stagesRes, oppsRes, customersRes, productsRes] = await Promise.all([
      supabase.from("opportunity_stages").select("id, name, sort_order").order("sort_order", { ascending: true }),
      supabase.from("opportunities").select("id, opportunity_number, title, customer_id, stage_id, estimated_value, expected_close_date, status, created_at, opened_at, owner_profile_id, source, priority, notes, customers:customer_id (name), profiles:owner_profile_id (full_name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, unit, sale_price").order("name"),
    ]);
    setStages(stagesRes.data ?? []);
    setOpportunities(oppsRes.data ?? []);
    setCustomers(customersRes.data ?? []);
    setProducts(productsRes.data ?? []);
    setLoaded(true);
  }

  useEffect(() => { if (company?.id) loadAll(); }, [company?.id]);

  const openOpportunities = opportunities.filter((o) => o.status === "aberta");
  const selected = opportunities.find((o) => o.id === selectedId);
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

  const funnelMetrics = useMemo(() => {
    const totalOpenValue = openOpportunities.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
    const won = opportunities.filter((o) => o.status === "ganha");
    const lost = opportunities.filter((o) => o.status === "perdida");
    const decided = won.length + lost.length;
    return {
      totalOpen: openOpportunities.length,
      totalOpenValue,
      conversionRate: decided ? (won.length / decided) * 100 : null,
      wonCount: won.length,
      lostCount: lost.length,
      wonValue: won.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
    };
  }, [opportunities]);

  function addNewItem() {
    const product = products.find((p) => p.id === newProductId);
    if (!product || Number(newQuantity) <= 0) return;
    const item = { product_id: product.id, sku: product.sku, name: product.name, unit: product.unit, quantity: Number(newQuantity), unit_price: Number(newUnitPrice || product.sale_price || 0) };
    setNewItems((prev) => [...prev, item]);
    setNewProductId(""); setNewQuantity("1"); setNewUnitPrice("");
    setNewValue((prev) => prev + item.quantity * item.unit_price);
  }

  function removeNewItem(index) {
    const item = newItems[index];
    setNewItems((prev) => prev.filter((_, i) => i !== index));
    setNewValue((prev) => Math.max(0, prev - item.quantity * item.unit_price));
  }

  async function createOpportunity(e) {
    e.preventDefault();
    if (!company?.id || !profile?.id || !newTitle.trim() || stages.length === 0) return;
    setCreating(true); setActionError("");
    const { data, error } = await supabase.from("opportunities").insert({
      company_id: company.id,
      title: newTitle.trim(),
      customer_id: newCustomerId || null,
      stage_id: stages[0].id,
      estimated_value: Number(newValue || 0),
      expected_close_date: newDate || null,
      owner_profile_id: profile.id,
      source: newSource,
      priority: newPriority,
    }).select("id").single();
    if (error) { setActionError(error.message); setCreating(false); return; }
    if (data?.id && newItems.length) {
      const { error: itemsError } = await supabase.from("opportunity_items").insert(newItems.map((it) => ({ company_id: company.id, opportunity_id: data.id, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, discount_percent: 0 })));
      if (itemsError) setActionError(itemsError.message);
    }
    setNewTitle(""); setNewCustomerId(""); setNewValue(0); setNewDate(""); setNewSource("Prospecção ativa"); setNewPriority("media"); setNewItems([]); setShowNewForm(false);
    await loadAll(); setCreating(false);
  }

  async function moveToStage(oppId, stageId) {
    const { error } = await supabase.from("opportunities").update({ stage_id: stageId }).eq("id", oppId);
    if (error) setActionError(error.message); else await loadAll();
  }

  async function setStatus(oppId, status, notes = null) {
    const payload = { status };
    if (notes !== null) payload.notes = notes;
    const { error } = await supabase.from("opportunities").update(payload).eq("id", oppId);
    if (error) setActionError(error.message); else { setSelectedId(""); await loadAll(); }
  }

  if (loaded && stages.length === 0) {
    return <div style={styles.notice}>Antes de cadastrar oportunidades, configure ao menos uma etapa em <Link to="/etapas-comercial" style={styles.link}>Comercial → Etapas</Link>.</div>;
  }

  return (
    <div>
      <header style={styles.header}>
        <div><h1 style={styles.title}>Oportunidades</h1><p style={styles.subtitle}>Prospecção comercial por cliente e produto, com rastreabilidade até o orçamento e pedido de venda.</p></div>
        <button style={styles.addBtn} onClick={() => setShowNewForm((v) => !v)} type="button">{showNewForm ? "Cancelar" : "+ Nova prospecção"}</button>
      </header>

      <div style={styles.metricsRow}>
        <MetricCard label="Abertas" value={funnelMetrics.totalOpen} />
        <MetricCard label="Valor em aberto" value={currency(funnelMetrics.totalOpenValue)} />
        <MetricCard label="Conversão" value={funnelMetrics.conversionRate !== null ? `${funnelMetrics.conversionRate.toFixed(0)}%` : "—"} />
        <MetricCard label="Ganhas" value={funnelMetrics.wonCount} />
        <MetricCard label="Perdidas" value={funnelMetrics.lostCount} />
        <MetricCard label="Valor ganho" value={currency(funnelMetrics.wonValue)} />
      </div>

      {actionError && <div style={styles.error}>{actionError}</div>}

      {showNewForm && <form onSubmit={createOpportunity} style={styles.form}>
        <div style={styles.formTop}><strong>Nova prospecção</strong><span style={styles.autoTag}>Responsável: {profile?.full_name || profile?.email || "usuário logado"}</span></div>
        <label style={styles.field}><span style={styles.fieldLabel}>Título da prospecção</span><input style={styles.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Fornecimento de componentes para linha 2027" required /></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Cliente</span><select style={styles.input} value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} required><option value="">Selecione o cliente...</option>{customerOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Origem</span><select style={styles.input} value={newSource} onChange={(e) => setNewSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Prioridade</span><select style={styles.input} value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>{Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Previsão de fechamento</span><input style={styles.input} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></label>

        <div style={styles.itemBox}><div style={styles.itemHeader}><strong>Itens da prospecção</strong><span style={styles.dim}>Selecione produtos já cadastrados</span></div>
          <div style={styles.itemAddRow}>
            <select style={styles.input} value={newProductId} onChange={(e) => { setNewProductId(e.target.value); const p = products.find((x) => x.id === e.target.value); if (p) setNewUnitPrice(String(p.sale_price ?? 0)); }}><option value="">Produto...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select>
            <input style={styles.input} type="number" min="0.01" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Qtd." />
            <input style={styles.input} type="number" min="0" step="any" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} placeholder="Preço unit." />
            <button type="button" style={styles.secondaryBtn} onClick={addNewItem}>+ Item</button>
          </div>
          {newItems.length > 0 && <div style={styles.itemTable}>{newItems.map((it, i) => <div key={`${it.product_id}-${i}`} style={styles.itemLine}><span><strong>{it.sku}</strong> — {it.name}</span><span>{it.quantity} {it.unit}</span><span>{currency(it.unit_price)}</span><button type="button" style={styles.removeMini} onClick={() => removeNewItem(i)}>Remover</button></div>)}</div>}
          <div style={styles.totalLine}><span>Valor estimado</span><strong>{currency(newValue)}</strong></div>
        </div>
        <button style={styles.submitBtn} type="submit" disabled={creating}>{creating ? "Criando..." : "Criar oportunidade"}</button>
      </form>}

      <div style={styles.board}>{stages.map((stage) => {
        const stageOpps = openOpportunities.filter((o) => o.stage_id === stage.id);
        const stageValue = stageOpps.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
        return <div key={stage.id} style={styles.column} onDragOver={(e) => e.preventDefault()} onDrop={() => draggingId && moveToStage(draggingId, stage.id)}>
          <div style={styles.columnHeader}><span style={styles.columnTitle}>{stage.name}</span><span style={styles.columnSub}>{stageOpps.length} · {currency(stageValue)}</span></div>
          <div style={styles.columnBody}>{stageOpps.map((o) => <div key={o.id} style={styles.card} draggable onDragStart={() => setDraggingId(o.id)} onDragEnd={() => setDraggingId("")} onClick={() => setSelectedId(o.id)}>
            <div style={styles.cardTop}><span style={styles.code}>{formatOpportunityNumber(o.opportunity_number)}</span><PriorityBadge value={o.priority} /></div>
            <span style={styles.cardTitle}>{o.title}</span><span style={styles.cardCustomer}>{o.customers?.name || "Sem cliente"}</span>
            <span style={styles.cardOwner}>👤 {o.profiles?.full_name || "Responsável não definido"}</span>
            <div style={styles.cardFooter}><span style={styles.cardValue}>{currency(o.estimated_value)}</span>{o.expected_close_date && <span style={styles.cardDate}>{formatDate(o.expected_close_date)}</span>}</div>
          </div>)}</div>
        </div>;
      })}</div>

      {selected && <OpportunityPanel opportunity={selected} stages={stages} company={company} profile={profile} navigate={navigate} onClose={() => setSelectedId("")} onSetStatus={setStatus} />}
    </div>
  );
}

function OpportunityPanel({ opportunity, stages, company, profile, navigate, onClose, onSetStatus }) {
  const [interactions, setInteractions] = useState([]);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [type, setType] = useState("nota");
  const [note, setNote] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [i, it, h, p] = await Promise.all([
      supabase.from("opportunity_interactions").select("id,type,note,created_at,profiles:author_profile_id(full_name)").eq("opportunity_id", opportunity.id).order("created_at", { ascending: false }),
      supabase.from("opportunity_items").select("id,quantity,unit_price,discount_percent,product_id,products:product_id(sku,name,unit)").eq("opportunity_id", opportunity.id).order("created_at"),
      supabase.from("opportunity_stage_history").select("id,from_stage_id,to_stage_id,note,created_at,profiles:actor_profile_id(full_name)").eq("opportunity_id", opportunity.id).order("created_at", { ascending: true }),
      supabase.from("products").select("id,sku,name,unit,sale_price").order("name"),
    ]);
    setInteractions(i.data ?? []); setItems(it.data ?? []); setHistory(h.data ?? []); setProducts(p.data ?? []);
  }
  useEffect(() => { load(); }, [opportunity.id]);

  const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent || 0) / 100), 0);

  async function addInteraction(e) {
    e.preventDefault(); if (!note.trim()) return; setSaving(true); setMessage("");
    const { error } = await supabase.from("opportunity_interactions").insert({ company_id: company.id, opportunity_id: opportunity.id, author_profile_id: profile?.id || null, type, note: note.trim() });
    if (error) setMessage(error.message); else { setNote(""); await load(); } setSaving(false);
  }

  async function addItem(e) {
    e.preventDefault(); const p = products.find((x) => x.id === newProductId); if (!p) return; setSaving(true);
    const { error } = await supabase.from("opportunity_items").insert({ company_id: company.id, opportunity_id: opportunity.id, product_id: p.id, quantity: Number(newQuantity), unit_price: Number(newUnitPrice || p.sale_price || 0), discount_percent: 0 });
    if (error) setMessage(error.message); else { setNewProductId(""); setNewQuantity("1"); setNewUnitPrice(""); await load(); } setSaving(false);
  }

  async function generateQuote() {
    if (!items.length || !opportunity.customer_id) { setMessage("A oportunidade precisa ter cliente e pelo menos um produto para gerar o orçamento."); return; }
    setSaving(true); setMessage("");
    const { data: existing } = await supabase.from("quotes").select("id,code,status").eq("opportunity_id", opportunity.id).maybeSingle();
    if (existing) { navigate("/orcamentos"); setSaving(false); return; }
    const code = `ORC-${formatOpportunityNumber(opportunity.opportunity_number).replace("OPP-", "")}`;
    const { data: quote, error } = await supabase.from("quotes").insert({ company_id: company.id, code, customer_id: opportunity.customer_id, opportunity_id: opportunity.id, status: "rascunho", valid_until: opportunity.expected_close_date || null, notes: `Origem: ${formatOpportunityNumber(opportunity.opportunity_number)}` }).select("id").single();
    if (error) { setMessage(error.message); setSaving(false); return; }
    const { error: itemError } = await supabase.from("quote_items").insert(items.map((it) => ({ company_id: company.id, quote_id: quote.id, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, discount_percent: it.discount_percent || 0 })));
    if (itemError) { setMessage(itemError.message); setSaving(false); return; }
    await supabase.from("opportunities").update({ stage_id: stages.find((s) => /orçamento|orcamento/i.test(s.name))?.id || opportunity.stage_id }).eq("id", opportunity.id);
    navigate("/orcamentos"); setSaving(false);
  }

  function printOpportunity() {
    const stage = stages.find((s) => s.id === opportunity.stage_id)?.name || "—";
    const rows = items.map((it) => `<tr><td>${it.products?.sku || ""}</td><td>${it.products?.name || ""}</td><td>${it.quantity} ${it.products?.unit || ""}</td><td>${currency(it.unit_price)}</td><td>${currency(Number(it.quantity) * Number(it.unit_price))}</td></tr>`).join("");
    const timeline = history.map((h) => `<div class="timeline-item"><strong>${formatDate(h.created_at)}</strong> — ${h.note || "Mudança de etapa"}<br/><span>${stages.find((s) => s.id === h.from_stage_id)?.name || "Início"} → ${stages.find((s) => s.id === h.to_stage_id)?.name || "—"}</span></div>`).join("");
    const html = `${brandHeader(company, "OPORTUNIDADE COMERCIAL", [["Nº", formatOpportunityNumber(opportunity.opportunity_number)], ["Abertura", formatDate(opportunity.opened_at || opportunity.created_at)], ["Fechamento previsto", formatDate(opportunity.expected_close_date)]])}<div class="section-title">Dados comerciais</div><div class="info-grid"><div><strong>Cliente:</strong> ${opportunity.customers?.name || "—"}</div><div><strong>Responsável:</strong> ${opportunity.profiles?.full_name || profile?.full_name || "—"}</div><div><strong>Etapa:</strong> ${stage}</div><div><strong>Status:</strong> ${opportunity.status}</div><div><strong>Origem:</strong> ${opportunity.source || "—"}</div><div><strong>Prioridade:</strong> ${PRIORITIES[opportunity.priority] || "—"}</div></div><div class="section-title">Produtos de interesse</div><table><thead><tr><th>SKU</th><th>Produto</th><th>Quantidade</th><th>Preço unit.</th><th>Total</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>Nenhum item.</td></tr>"}</tbody></table><div class="totals-box"><div class="total-row-final"><span>Valor estimado</span><span>${currency(total || opportunity.estimated_value)}</span></div></div><div class="section-title">Linha do tempo</div>${timeline || "<p>Oportunidade criada.</p>"}`;
    openPrintWindow(`Oportunidade ${formatOpportunityNumber(opportunity.opportunity_number)}`, html);
  }

  const currentStageIndex = Math.max(0, stages.findIndex((s) => s.id === opportunity.stage_id));

  return <div style={styles.overlay} onClick={onClose}><div style={styles.panel} onClick={(e) => e.stopPropagation()}>
    <div style={styles.panelHeader}><div><span style={styles.codeLarge}>{formatOpportunityNumber(opportunity.opportunity_number)}</span><h2 style={styles.panelTitle}>{opportunity.title}</h2><span style={styles.panelSub}>{opportunity.customers?.name || "Sem cliente"}</span></div><button style={styles.closeBtn} onClick={onClose} type="button">✕</button></div>

    <div style={styles.timeline}>{stages.map((stage, index) => <div key={stage.id} style={{ ...styles.timelineStep, ...(index <= currentStageIndex ? styles.timelineDone : {}) }}><span style={styles.timelineDot}>{index < currentStageIndex ? "✓" : index + 1}</span><span>{stage.name}</span></div>)}</div>

    <div style={styles.infoGrid}><Info label="Responsável" value={opportunity.profiles?.full_name || profile?.full_name || "Não definido"} /><Info label="Origem" value={opportunity.source || "—"} /><Info label="Prioridade" value={PRIORITIES[opportunity.priority] || "—"} /><Info label="Fechamento" value={formatDate(opportunity.expected_close_date)} /></div>

    <div style={styles.panelActions}><button style={styles.printBtn} onClick={printOpportunity} type="button">🖨 Imprimir</button><button style={styles.quoteBtn} onClick={generateQuote} disabled={saving || !items.length || !opportunity.customer_id} type="button">{saving ? "Processando..." : "Gerar Orçamento"}</button></div>
    {message && <div style={styles.error}>{message}</div>}

    <section><div style={styles.sectionHeader}><span style={styles.sectionLabel}>Produtos de interesse</span><span style={styles.totalBadge}>{currency(total || opportunity.estimated_value)}</span></div>
      <form onSubmit={addItem} style={styles.compactForm}><select style={styles.input} value={newProductId} onChange={(e) => { setNewProductId(e.target.value); const p = products.find((x) => x.id === e.target.value); if (p) setNewUnitPrice(String(p.sale_price ?? 0)); }}><option value="">Adicionar produto...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select><input style={styles.smallInput} type="number" min="0.01" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} /><input style={styles.smallInput} type="number" min="0" step="any" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} /><button style={styles.secondaryBtn} type="submit">+ Adicionar</button></form>
      {items.length ? <div style={styles.itemTable}>{items.map((it) => <div key={it.id} style={styles.itemLine}><span><strong>{it.products?.sku}</strong> — {it.products?.name}</span><span>{it.quantity} {it.products?.unit}</span><span>{currency(it.unit_price)}</span></div>)}</div> : <p style={styles.dim}>Nenhum produto vinculado.</p>}
    </section>

    <section><span style={styles.sectionLabel}>Histórico / linha do tempo</span><div style={styles.historyList}>{history.map((h) => <div key={h.id} style={styles.historyItem}><span style={styles.historyDate}>{formatDate(h.created_at)}</span><span><strong>{stages.find((s) => s.id === h.from_stage_id)?.name || "Início"} → {stages.find((s) => s.id === h.to_stage_id)?.name || "—"}</strong><br/><span style={styles.dim}>{h.profiles?.full_name || "Sistema"}</span></span></div>)}{interactions.map((i) => <div key={i.id} style={styles.historyItem}><span style={styles.historyDate}>{formatDate(i.created_at)}</span><span><strong>{INTERACTION_LABEL[i.type]}</strong> — {i.note}<br/><span style={styles.dim}>{i.profiles?.full_name || "Usuário"}</span></span></div>)}</div></section>

    <form onSubmit={addInteraction} style={styles.interactionForm}><select style={styles.typeSelect} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(INTERACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><input style={styles.noteInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Registrar contato, reunião, e-mail ou nota..." /><button style={styles.addNoteBtn} type="submit" disabled={saving}>Adicionar</button></form>

    {opportunity.status === "aberta" && <div style={styles.statusActions}><button style={styles.winBtn} onClick={() => onSetStatus(opportunity.id, "ganha")} type="button">✓ Ganha</button><div style={styles.lossBox}><input style={styles.noteInput} value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="Motivo da perda (se houver)" /><button style={styles.loseBtn} onClick={() => onSetStatus(opportunity.id, "perdida", lossReason.trim() || "Sem motivo informado")} type="button">Perdida</button></div></div>}
  </div></div>;
}

function Info({ label, value }) { return <div style={styles.infoCard}><span style={styles.fieldLabel}>{label}</span><strong>{value}</strong></div>; }
function MetricCard({ label, value }) { return <div style={styles.metricCard}><span style={styles.metricLabel}>{label}</span><span style={styles.metricValue}>{value}</span></div>; }
function PriorityBadge({ value }) { return <span style={styles.priority}>{PRIORITIES[value] || "Média"}</span>; }
function formatOpportunityNumber(n) { return `OPP-${String(n ?? 0).padStart(6, "0")}`; }

const styles = {
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 20 },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 760, lineHeight: 1.5 },
  addBtn: { background: "var(--amber)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "10px 16px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  metricsRow: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  metricCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 130 },
  metricLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--text-dim)", fontWeight: 700 },
  metricValue: { fontFamily: "var(--font-display)", fontSize: 18 },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 },
  formTop: { gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 },
  autoTag: { fontSize: 12, color: "var(--text-dim)" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 10.5, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" },
  input: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "9px 10px", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" },
  smallInput: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "9px 10px", color: "var(--text)", fontSize: 13, width: 100, boxSizing: "border-box" },
  itemBox: { gridColumn: "1/-1", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 14 },
  itemHeader: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  itemAddRow: { display: "grid", gridTemplateColumns: "2fr 100px 130px auto", gap: 8, alignItems: "center" },
  itemTable: { marginTop: 10, borderTop: "1px solid var(--line)" },
  itemLine: { display: "grid", gridTemplateColumns: "1fr 100px 110px auto", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 },
  totalLine: { display: "flex", justifyContent: "flex-end", gap: 20, paddingTop: 12, fontSize: 14 },
  secondaryBtn: { background: "transparent", border: "1px solid var(--line)", color: "var(--text)", borderRadius: "var(--radius)", padding: "9px 12px", fontWeight: 700, cursor: "pointer" },
  submitBtn: { background: "var(--green)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "11px 18px", fontWeight: 700, cursor: "pointer" },
  board: { display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 },
  column: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", minWidth: 270, maxWidth: 270, display: "flex", flexDirection: "column", maxHeight: 660 },
  columnHeader: { padding: "12px 14px", borderBottom: "1px solid var(--line)" },
  columnTitle: { fontSize: 13, fontWeight: 700, display: "block" },
  columnSub: { fontSize: 11, color: "var(--text-dim)" },
  columnBody: { padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 11, cursor: "grab", display: "flex", flexDirection: "column", gap: 5 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 10.5, fontWeight: 800, color: "var(--amber)" },
  cardTitle: { fontSize: 12.5, fontWeight: 700 },
  cardCustomer: { fontSize: 11.5, color: "var(--text-dim)" },
  cardOwner: { fontSize: 10.5, color: "var(--text-dim)" },
  cardFooter: { display: "flex", justifyContent: "space-between", marginTop: 4 },
  cardValue: { fontSize: 12, fontWeight: 700, color: "var(--amber)" },
  cardDate: { fontSize: 11, color: "var(--text-dim)" },
  priority: { fontSize: 9.5, padding: "3px 6px", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text-dim)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", justifyContent: "flex-end", zIndex: 1000 },
  panel: { background: "var(--panel)", width: 680, maxWidth: "94vw", height: "100%", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18, boxSizing: "border-box" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  codeLarge: { fontSize: 11, fontWeight: 800, color: "var(--amber)" },
  panelTitle: { fontFamily: "var(--font-display)", fontSize: 19, margin: "3px 0 2px" },
  panelSub: { fontSize: 12.5, color: "var(--text-dim)" },
  closeBtn: { background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 18, cursor: "pointer" },
  timeline: { display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", padding: "4px 0 12px" },
  timelineStep: { minWidth: 92, flex: 1, position: "relative", textAlign: "center", color: "var(--text-dim)", fontSize: 10.5 },
  timelineDone: { color: "var(--text)" },
  timelineDot: { display: "flex", width: 26, height: 26, borderRadius: "50%", margin: "0 auto 6px", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", background: "var(--panel-2)", fontWeight: 700 },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 },
  infoCard: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 10, display: "flex", flexDirection: "column", gap: 4, fontSize: 12 },
  panelActions: { display: "flex", gap: 10 },
  printBtn: { background: "transparent", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  quoteBtn: { background: "var(--amber)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--text-dim)", fontWeight: 700 },
  totalBadge: { fontWeight: 800, color: "var(--amber)" },
  compactForm: { display: "grid", gridTemplateColumns: "1fr 90px 110px auto", gap: 8, alignItems: "center", margin: "8px 0 10px" },
  historyList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 },
  historyItem: { display: "grid", gridTemplateColumns: "86px 1fr", gap: 10, padding: "9px 10px", background: "var(--panel-2)", borderRadius: "var(--radius)", fontSize: 12.5 },
  historyDate: { color: "var(--text-dim)", fontSize: 11 },
  interactionForm: { display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 8 },
  typeSelect: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "8px 10px", color: "var(--text)", fontSize: 12.5 },
  noteInput: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "8px 10px", fontSize: 12.5, color: "var(--text)", boxSizing: "border-box", width: "100%" },
  addNoteBtn: { background: "var(--amber)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "8px 12px", fontWeight: 700, cursor: "pointer" },
  statusActions: { display: "flex", gap: 10, paddingTop: 4 },
  winBtn: { background: "var(--green)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  lossBox: { display: "flex", flex: 1, gap: 8 },
  loseBtn: { background: "transparent", color: "var(--red)", border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  removeMini: { background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 11 },
  dim: { color: "var(--text-dim)", fontSize: 12.5 },
  notice: { background: "rgba(232,163,61,.1)", border: "1px solid var(--amber)", color: "var(--text)", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620 },
  link: { color: "var(--amber)", fontWeight: 600 },
  error: { background: "rgba(217,105,95,.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 12.5 },
};
