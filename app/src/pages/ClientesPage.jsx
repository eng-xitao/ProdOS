import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import CurrencyInput from "../components/CurrencyInput";

const fields = [
  ["code", "Código", "text"],
  ["name", "Razão Social", "text"],
  ["nome_fantasia", "Nome Fantasia", "text"],
  ["document", "CNPJ", "text"],
  ["inscricao_estadual", "Inscrição Estadual", "text"],
  ["cep", "CEP", "text"],
  ["logradouro", "Logradouro", "text"],
  ["numero", "Número", "text"],
  ["complemento", "Complemento", "text"],
  ["bairro", "Bairro", "text"],
  ["municipio", "Cidade", "text"],
  ["uf", "Estado", "text"],
  ["pais", "País", "text"],
  ["contato", "Contato", "text"],
  ["departamento", "Departamento", "text"],
  ["phone", "Telefone 1", "text"],
  ["phone2", "Telefone 2", "text"],
  ["email", "E-mail", "email"],
  ["status", "Status", "select"],
  ["condicao_pagamento", "Condição de Pagamento", "select"],
  ["credit_limit", "Limite de Crédito", "currency"],
  ["address", "Observações", "text"],
];

const statusOptions = ["Ativo", "Inativo", "Bloqueado"];
const paymentOptions = ["À vista", "7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "45 dias", "60 dias"];

export default function ClientesPage() {
  const { company } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ status: "Ativo" });
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!company?.id) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("customers")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [company?.id]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => [r.code, r.name, r.nome_fantasia, r.document, r.contato].some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [rows, search]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.includes(r.id));

  function setField(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function toggleSelected(id) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) setSelected((current) => current.filter((id) => !filteredRows.some((r) => r.id === id)));
    else setSelected((current) => [...new Set([...current, ...filteredRows.map((r) => r.id)])]);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ status: "Ativo" });
    setFormOpen(true);
    setError("");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({ ...row });
    setFormOpen(true);
    setError("");
  }

  function cancelForm() {
    setEditingId(null);
    setForm({ status: "Ativo" });
    setFormOpen(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!company?.id) return;
    setSaving(true);
    setError("");
    const payload = { ...form };
    delete payload.id; delete payload.company_id; delete payload.created_at;
    const result = editingId
      ? await supabase.from("customers").update(payload).eq("id", editingId).eq("company_id", company.id)
      : await supabase.from("customers").insert({ ...payload, company_id: company.id });
    if (result.error) setError(result.error.message);
    else { cancelForm(); await load(); }
    setSaving(false);
  }

  async function remove(id) {
    if (!(await confirmDelete(company))) return;
    const { error: deleteError } = await supabase.from("customers").delete().eq("id", id).eq("company_id", company.id);
    if (deleteError) setError(deleteError.message);
    else { setRows((r) => r.filter((x) => x.id !== id)); setSelected((s) => s.filter((x) => x !== id)); }
  }

  function printSelected() {
    if (!selected.length) { setError("Selecione pelo menos um cliente para imprimir."); return; }
    window.print();
  }

  const selectedRows = rows.filter((r) => selected.includes(r.id));

  return (
    <div>
      <style>{`@page { size: A4; margin: 14mm; } @media print { body * { visibility: hidden !important; } .customer-print-area, .customer-print-area * { visibility: visible !important; } .customer-print-area { position: absolute; left: 0; top: 0; width: 100%; } .customer-print-page { break-after: page; page-break-after: always; min-height: 260mm; } .customer-print-page:last-child { break-after: auto; page-break-after: auto; } }`}</style>

      <div className="no-print">
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Clientes</h1>
            <p style={styles.subtitle}>Cadastro completo de clientes</p>
          </div>
          <div style={styles.headerActions}>
            {selected.length > 0 && <button type="button" onClick={printSelected} style={styles.printBtn}>🖨️ Imprimir selecionados ({selected.length})</button>}
            <button type="button" onClick={openCreate} style={styles.addBtn}>+ Novo cliente</button>
          </div>
        </header>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.listToolbar}>
          <label style={styles.searchWrap}><span>🔎</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar cliente..." style={styles.search} /></label>
          <button type="button" onClick={toggleAllVisible} style={styles.selectBtn}>{allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}</button>
          {selected.length > 0 && <button type="button" onClick={printSelected} style={styles.printBtn}>🖨️ Imprimir selecionados</button>}
        </div>

        {formOpen && (
          <form onSubmit={save} style={styles.form}>
            <div style={styles.formHeader}><div><strong>{editingId ? "Editar cliente" : "Novo cliente"}</strong><div style={styles.formHint}>Preencha os dados cadastrais, endereço, contato e condições comerciais.</div></div><button type="button" onClick={cancelForm} style={styles.closeBtn}>Fechar</button></div>
            <div style={styles.grid}>
              {fields.map(([key, label, type]) => (
                <label key={key} style={styles.field}>
                  <span>{label}</span>
                  {type === "select" ? <select value={form[key] ?? ""} onChange={(e) => setField(key, e.target.value)} style={styles.input}><option value="">Selecione...</option>{(key === "status" ? statusOptions : paymentOptions).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  : type === "currency" ? <CurrencyInput value={form[key] ?? 0} onChange={(v) => setField(key, v)} />
                  : <input type={type} value={form[key] ?? ""} onChange={(e) => setField(key, e.target.value)} style={styles.input} placeholder={label} />}
                </label>
              ))}
            </div>
            <div style={styles.formActions}><button type="button" onClick={cancelForm} style={styles.cancelBtn}>Cancelar</button><button type="submit" disabled={saving} style={styles.saveBtn}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar cliente"}</button></div>
          </form>
        )}

        <div style={styles.selectionBar}><strong>{selected.length}</strong> selecionado(s) {selected.length > 0 && <button type="button" onClick={() => setSelected([])} style={styles.linkBtn}>Limpar seleção</button>}</div>

        {loading ? <p style={styles.dim}>Carregando...</p> : filteredRows.length === 0 ? <p style={styles.dim}>Nenhum cliente cadastrado.</p> : (
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.checkTh}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th><th style={styles.th}>Código</th><th style={styles.th}>Razão Social</th><th style={styles.th}>Nome Fantasia</th><th style={styles.th}>CNPJ</th><th style={styles.th}>Contato</th><th style={styles.th}>Telefone</th><th style={styles.th}>Status</th><th style={styles.th}>Ações</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td style={styles.td}><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td><td style={styles.td}>{row.code || "—"}</td><td style={styles.td}><strong>{row.name || "—"}</strong></td><td style={styles.td}>{row.nome_fantasia || "—"}</td><td style={styles.td}>{row.document || "—"}</td><td style={styles.td}>{row.contato || "—"}</td><td style={styles.td}>{row.phone || "—"}</td><td style={styles.td}><span style={statusStyle(row.status)}>{row.status || "Ativo"}</span></td><td style={{ ...styles.td, whiteSpace: "nowrap" }}><button type="button" onClick={() => openEdit(row)} style={styles.editBtn}>Editar</button><button type="button" onClick={() => remove(row.id)} style={styles.deleteBtn}>Excluir</button></td></tr>)}</tbody></table></div>
        )}
      </div>

      <div className="customer-print-area" aria-hidden="true">
        {selectedRows.map((row) => <CustomerPrintPage key={row.id} row={row} company={company} />)}
      </div>
    </div>
  );
}

function CustomerPrintPage({ row, company }) {
  const address = [row.logradouro, row.numero].filter(Boolean).join(", ");
  const city = [row.municipio, row.uf].filter(Boolean).join(" - ");
  return <section className="customer-print-page" style={printStyles.page}>
    <div style={printStyles.top}><div style={printStyles.brand}>ProdOS</div><div style={printStyles.doc}>FICHA CADASTRAL DE CLIENTE</div></div>
    <div style={printStyles.company}>{company?.name || "Empresa"}</div>
    <h1 style={printStyles.heading}>{row.name || "Cliente"}</h1>
    <p style={printStyles.code}>Código: {row.code || "—"} · Status: {row.status || "Ativo"}</p>
    <PrintSection title="Identificação">
      <PrintGrid items={[["Razão Social", row.name], ["Nome Fantasia", row.nome_fantasia], ["CNPJ", row.document], ["Inscrição Estadual", row.inscricao_estadual]]} />
    </PrintSection>
    <PrintSection title="Endereço">
      <PrintGrid items={[["CEP", row.cep], ["Logradouro", address], ["Complemento", row.complemento], ["Bairro", row.bairro], ["Cidade", city], ["País", row.pais]]} />
    </PrintSection>
    <PrintSection title="Contato">
      <PrintGrid items={[["Contato", row.contato], ["Departamento", row.departamento], ["Telefone 1", row.phone], ["Telefone 2", row.phone2], ["E-mail", row.email]]} />
    </PrintSection>
    <PrintSection title="Condições Comerciais">
      <PrintGrid items={[["Status", row.status], ["Condição de Pagamento", row.condicao_pagamento], ["Limite de Crédito", formatCurrency(row.credit_limit)]]} />
    </PrintSection>
    {row.address && <PrintSection title="Observações"><p style={printStyles.obs}>{row.address}</p></PrintSection>}
    <div style={printStyles.footer}>Documento gerado pelo ProdOS · {new Date().toLocaleString("pt-BR")}</div>
  </section>;
}

function PrintSection({ title, children }) { return <div style={printStyles.section}><h2 style={printStyles.sectionTitle}>{title}</h2>{children}</div>; }
function PrintGrid({ items }) { return <div style={printStyles.grid}>{items.map(([label, value]) => <div key={label} style={printStyles.item}><span style={printStyles.label}>{label}</span><strong style={printStyles.value}>{value || "—"}</strong></div>)}</div>; }
function formatCurrency(v) { return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`; }
function statusStyle(status) { const base = { display: "inline-block", padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700 }; if (status === "Inativo") return { ...base, background: "#FDE8E7", color: "#A53B34" }; if (status === "Bloqueado") return { ...base, background: "#FFF0D8", color: "#8A5A00" }; return { ...base, background: "#E6F5EC", color: "#24754C" }; }

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  headerActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  addBtn: { background: "var(--amber)", color: "#fff", border: 0, borderRadius: "var(--radius)", padding: "10px 16px", fontWeight: 700, cursor: "pointer" },
  printBtn: { background: "var(--panel)", color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: "var(--radius)", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  listToolbar: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "0 10px", flex: "1 1 280px" },
  search: { border: 0, outline: 0, background: "transparent", padding: "10px 4px", width: "100%", color: "var(--text)" },
  selectBtn: { background: "var(--panel)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: "var(--radius)", padding: "10px 14px", fontWeight: 600, cursor: "pointer" },
  form: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 18, marginBottom: 18 },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  formHint: { color: "var(--text-dim)", fontSize: 12, marginTop: 4 },
  closeBtn: { background: "transparent", border: 0, color: "var(--text-dim)", cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-dim)" },
  input: { width: "100%", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "9px 10px", color: "var(--text)", fontSize: 13 },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelBtn: { background: "transparent", border: "1px solid var(--line)", color: "var(--text-dim)", borderRadius: "var(--radius)", padding: "9px 16px", cursor: "pointer" },
  saveBtn: { background: "var(--green)", color: "#fff", border: 0, borderRadius: "var(--radius)", padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  selectionBar: { fontSize: 12, color: "var(--text-dim)", margin: "10px 0", display: "flex", gap: 8, alignItems: "center" },
  linkBtn: { background: "none", border: 0, color: "var(--amber)", cursor: "pointer", padding: 0 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  checkTh: { width: 42, padding: "10px 12px", background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-dim)", padding: "10px 12px", background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  td: { padding: "10px 12px", fontSize: 13, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  editBtn: { background: "transparent", border: "1px solid var(--line)", color: "var(--amber)", borderRadius: "var(--radius)", padding: "5px 9px", cursor: "pointer", marginRight: 6 },
  deleteBtn: { background: "transparent", border: "1px solid var(--line)", color: "var(--red)", borderRadius: "var(--radius)", padding: "5px 9px", cursor: "pointer" },
  dim: { color: "var(--text-dim)" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", marginBottom: 12, fontSize: 13 },
};

const printStyles = {
  page: { fontFamily: "Arial, sans-serif", color: "#222", background: "#fff", minHeight: "260mm", padding: "4mm", position: "relative" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #222", paddingBottom: 12, marginBottom: 18 },
  brand: { fontSize: 22, fontWeight: 800, letterSpacing: "0.05em" },
  doc: { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" },
  company: { fontSize: 11, color: "#666", marginBottom: 10 },
  heading: { fontSize: 24, margin: "0 0 5px" },
  code: { fontSize: 11, color: "#666", margin: "0 0 18px" },
  section: { border: "1px solid #ccc", marginBottom: 12, padding: 12 },
  sectionTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px", borderBottom: "1px solid #ddd", paddingBottom: 7 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "9px 20px" },
  item: { minHeight: 30, display: "flex", flexDirection: "column", justifyContent: "center" },
  label: { fontSize: 8.5, textTransform: "uppercase", color: "#777", marginBottom: 3 },
  value: { fontSize: 10.5, fontWeight: 600, wordBreak: "break-word" },
  obs: { fontSize: 10.5, lineHeight: 1.5, margin: 0 },
  footer: { position: "absolute", bottom: 0, left: "4mm", right: "4mm", borderTop: "1px solid #ccc", paddingTop: 8, fontSize: 8.5, color: "#777" },
};
