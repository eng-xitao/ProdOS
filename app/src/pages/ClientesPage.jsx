import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import CurrencyInput from "../components/CurrencyInput";
import logoFull from "../assets/logo-full.png";

const statusOptions = ["Ativo", "Inativo", "Bloqueado"];
const ufOptions = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const emptyForm = {
  name: "", nome_fantasia: "", document: "", inscricao_estadual: "", cep: "", logradouro: "", numero: "",
  complemento: "", bairro: "", municipio: "", uf: "", pais: "Brasil", contato: "", departamento: "",
  phone: "", phone2: "", email: "", status: "Ativo", condicao_pagamento: "", credit_limit: 0, address: ""
};

function onlyDigits(value) { return String(value ?? "").replace(/\D/g, ""); }
function maskCEP(value) { const d = onlyDigits(value).slice(0, 8); return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d; }
function maskPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function maskCNPJ(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

export default function ClientesPage() {
  const { company } = useAuth();
  const [rows, setRows] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!company?.id) return;
    setLoading(true); setError("");
    const [{ data, error: customerError }, { data: terms, error: termsError }] = await Promise.all([
      supabase.from("customers").select("*").eq("company_id", company.id).order("created_at", { ascending: false }),
      supabase.from("payment_terms").select("id,name,installments,days_between").eq("company_id", company.id).order("name")
    ]);
    if (customerError) setError(customerError.message); else setRows(data ?? []);
    if (termsError) setError(termsError.message); else setPaymentTerms(terms ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [company?.id]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => [r.code, r.name, r.nome_fantasia, r.document, r.contato, r.email].some(v => String(v ?? "").toLowerCase().includes(term)));
  }, [rows, search]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every(r => selected.includes(r.id));
  const selectedRows = rows.filter(r => selected.includes(r.id));

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })); }
  function toggleSelected(id) { setSelected(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
  function toggleAllVisible() {
    if (allVisibleSelected) setSelected(c => c.filter(id => !filteredRows.some(r => r.id === id)));
    else setSelected(c => [...new Set([...c, ...filteredRows.map(r => r.id)])]);
  }
  function openCreate() { setEditingId(null); setForm({ ...emptyForm }); setFormOpen(true); setError(""); }
  function openEdit(row) { setEditingId(row.id); setForm({ ...emptyForm, ...row }); setFormOpen(true); setError(""); }
  function cancelForm() { setEditingId(null); setForm({ ...emptyForm }); setFormOpen(false); }

  async function save(e) {
    e.preventDefault();
    if (!company?.id) return;
    if (!form.name.trim()) { setError("Informe a Razão Social."); return; }
    setSaving(true); setError("");
    const payload = { ...form };
    delete payload.id; delete payload.company_id; delete payload.created_at; delete payload.code;
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
    else { setRows(r => r.filter(x => x.id !== id)); setSelected(s => s.filter(x => x !== id)); }
  }

  function printSelected() {
    if (!selected.length) { setError("Selecione pelo menos um cliente para imprimir."); return; }
    window.print();
  }

  return <div>
    <style>{`@page{size:A4;margin:14mm}@media print{body *{visibility:hidden!important}.customer-print-area,.customer-print-area *{visibility:visible!important}.customer-print-area{position:absolute;left:0;top:0;width:100%}.customer-print-page{break-after:page;page-break-after:always;min-height:260mm}.customer-print-page:last-child{break-after:auto;page-break-after:auto}}`}</style>
    <div className="no-print">
      <header style={styles.header}>
        <div><h1 style={styles.title}>Clientes</h1><p style={styles.subtitle}>Cadastro completo de clientes</p></div>
        <div style={styles.headerActions}>
          {selected.length > 0 && <button type="button" onClick={printSelected} style={styles.printBtn}>🖨️ Imprimir selecionados ({selected.length})</button>}
          <button type="button" onClick={openCreate} style={styles.addBtn}>+ Novo cliente</button>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.listToolbar}>
        <label style={styles.searchWrap}><span>🔎</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por código, razão social, CNPJ..." style={styles.search}/></label>
        <button type="button" onClick={toggleAllVisible} style={styles.selectBtn}>{allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}</button>
        {selected.length > 0 && <button type="button" onClick={printSelected} style={styles.printBtn}>🖨️ Imprimir selecionados</button>}
      </div>

      {formOpen && <form onSubmit={save} style={styles.form}>
        <div style={styles.formHeader}><div><strong>{editingId ? "Editar cliente" : "Novo cliente"}</strong><div style={styles.formHint}>O código é gerado automaticamente pelo ProdOS e não pode ser repetido.</div></div><button type="button" onClick={cancelForm} style={styles.closeBtn}>Fechar</button></div>
        <section style={styles.section}><h3 style={styles.sectionTitle}>Identificação</h3><div style={styles.grid}>
          <ReadOnlyCode editingId={editingId} value={form.code}/>
          <Field label="Razão Social" required><input value={form.name} onChange={e => setField("name", e.target.value)} style={styles.input} placeholder="Razão Social" required/></Field>
          <Field label="Nome Fantasia"><input value={form.nome_fantasia} onChange={e => setField("nome_fantasia", e.target.value)} style={styles.input} placeholder="Nome Fantasia"/></Field>
          <Field label="CNPJ"><input value={form.document} onChange={e => setField("document", maskCNPJ(e.target.value))} style={styles.input} placeholder="00.000.000/0000-00" inputMode="numeric"/></Field>
          <Field label="Inscrição Estadual"><input value={form.inscricao_estadual} onChange={e => setField("inscricao_estadual", e.target.value)} style={styles.input} placeholder="Inscrição Estadual"/></Field>
          <Field label="Status"><select value={form.status} onChange={e => setField("status", e.target.value)} style={styles.input}>{statusOptions.map(o => <option key={o}>{o}</option>)}</select></Field>
        </div></section>

        <section style={styles.section}><h3 style={styles.sectionTitle}>Endereço</h3><div style={styles.grid}>
          <Field label="CEP"><input value={form.cep} onChange={e => setField("cep", maskCEP(e.target.value))} style={styles.input} placeholder="00000-000" inputMode="numeric" maxLength={9}/></Field>
          <Field label="Endereço"><input value={form.logradouro} onChange={e => setField("logradouro", e.target.value)} style={styles.input} placeholder="Endereço"/></Field>
          <Field label="Número"><input value={form.numero} onChange={e => setField("numero", e.target.value)} style={styles.input} placeholder="Número"/></Field>
          <Field label="Complemento"><input value={form.complemento} onChange={e => setField("complemento", e.target.value)} style={styles.input} placeholder="Complemento"/></Field>
          <Field label="Bairro"><input value={form.bairro} onChange={e => setField("bairro", e.target.value)} style={styles.input} placeholder="Bairro"/></Field>
          <Field label="Cidade"><input value={form.municipio} onChange={e => setField("municipio", e.target.value)} style={styles.input} placeholder="Cidade"/></Field>
          <Field label="Estado"><select value={form.uf} onChange={e => setField("uf", e.target.value)} style={styles.input}><option value="">Selecione...</option>{ufOptions.map(o => <option key={o}>{o}</option>)}</select></Field>
          <Field label="País"><input value={form.pais} onChange={e => setField("pais", e.target.value)} style={styles.input} placeholder="Brasil"/></Field>
        </div></section>

        <section style={styles.section}><h3 style={styles.sectionTitle}>Contato</h3><div style={styles.grid}>
          <Field label="Contato"><input value={form.contato} onChange={e => setField("contato", e.target.value)} style={styles.input} placeholder="Nome do contato"/></Field>
          <Field label="Departamento"><input value={form.departamento} onChange={e => setField("departamento", e.target.value)} style={styles.input} placeholder="Departamento"/></Field>
          <Field label="Telefone 1"><input value={form.phone} onChange={e => setField("phone", maskPhone(e.target.value))} style={styles.input} placeholder="(00) 0000-0000 ou (00) 00000-0000" inputMode="tel" maxLength={15}/></Field>
          <Field label="Telefone 2"><input value={form.phone2} onChange={e => setField("phone2", maskPhone(e.target.value))} style={styles.input} placeholder="(00) 00000-0000" inputMode="tel" maxLength={15}/></Field>
          <Field label="E-mail"><input type="email" value={form.email} onChange={e => setField("email", e.target.value)} style={styles.input} placeholder="cliente@empresa.com.br"/></Field>
        </div></section>

        <section style={styles.section}><h3 style={styles.sectionTitle}>Condições Comerciais</h3><div style={styles.grid}>
          <Field label="Condição de Pagamento"><select value={form.condicao_pagamento} onChange={e => setField("condicao_pagamento", e.target.value)} style={styles.input}><option value="">Selecione...</option>{paymentTerms.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>{paymentTerms.length === 0 && <small style={styles.help}>Cadastre as condições em Cadastros → Condições de Pagamento.</small>}</Field>
          <Field label="Limite de Crédito"><CurrencyInput value={form.credit_limit ?? 0} onChange={v => setField("credit_limit", v)}/></Field>
        </div></section>

        <div style={styles.formActions}><button type="button" onClick={cancelForm} style={styles.cancelBtn}>Cancelar</button><button type="submit" disabled={saving} style={styles.saveBtn}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar cliente"}</button></div>
      </form>}

      <div style={styles.selectionBar}><strong>{selected.length}</strong> selecionado(s) {selected.length > 0 && <button type="button" onClick={() => setSelected([])} style={styles.linkBtn}>Limpar seleção</button>}</div>
      {loading ? <p style={styles.dim}>Carregando...</p> : filteredRows.length === 0 ? <p style={styles.dim}>Nenhum cliente cadastrado.</p> : <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.checkTh}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}/></th><th style={styles.th}>Código</th><th style={styles.th}>Razão Social</th><th style={styles.th}>Nome Fantasia</th><th style={styles.th}>CNPJ</th><th style={styles.th}>Contato</th><th style={styles.th}>Telefone</th><th style={styles.th}>Status</th><th style={styles.th}>Ações</th></tr></thead><tbody>{filteredRows.map(row => <tr key={row.id}><td style={styles.td}><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelected(row.id)}/></td><td style={styles.td}><strong>{row.code || "—"}</strong></td><td style={styles.td}>{row.name || "—"}</td><td style={styles.td}>{row.nome_fantasia || "—"}</td><td style={styles.td}>{row.document || "—"}</td><td style={styles.td}>{row.contato || "—"}</td><td style={styles.td}>{row.phone || "—"}</td><td style={styles.td}><span style={statusStyle(row.status)}>{row.status || "Ativo"}</span></td><td style={{ ...styles.td, whiteSpace: "nowrap" }}><button type="button" onClick={() => openEdit(row)} style={styles.editBtn}>Editar</button><button type="button" onClick={() => remove(row.id)} style={styles.deleteBtn}>Excluir</button></td></tr>)}</tbody></table></div>}
    </div>
    <div className="customer-print-area" aria-hidden="true">{selectedRows.map(row => <CustomerPrintPage key={row.id} row={row} company={company}/>)}</div>
  </div>;
}

function Field({ label, required, children }) { return <label style={styles.field}><span>{label}{required && " *"}</span>{children}</label>; }
function ReadOnlyCode({ editingId, value }) { return <Field label="Código"><div style={styles.codeBox}>{editingId ? (value || "—") : "Será gerado automaticamente"}</div></Field>; }
function CustomerPrintPage({ row, company }) { const address = [row.logradouro, row.numero].filter(Boolean).join(", "); const city = [row.municipio, row.uf].filter(Boolean).join(" - "); return <section className="customer-print-page" style={printStyles.page}><div style={printStyles.top}><img src={logoFull} alt="ProdOS" style={printStyles.logo}/><div style={printStyles.doc}>FICHA CADASTRAL DE CLIENTE</div></div><div style={printStyles.company}>{company?.name || "Empresa"}</div><h1 style={printStyles.heading}>{row.name || "Cliente"}</h1><p style={printStyles.code}>Código: {row.code || "—"} · Status: {row.status || "Ativo"}</p><PrintSection title="Identificação"><PrintGrid items={[["Razão Social",row.name],["Nome Fantasia",row.nome_fantasia],["CNPJ",row.document],["Inscrição Estadual",row.inscricao_estadual]]}/></PrintSection><PrintSection title="Endereço"><PrintGrid items={[["CEP",row.cep],["Endereço",address],["Complemento",row.complemento],["Bairro",row.bairro],["Cidade",city],["País",row.pais]]}/></PrintSection><PrintSection title="Contato"><PrintGrid items={[["Contato",row.contato],["Departamento",row.departamento],["Telefone 1",row.phone],["Telefone 2",row.phone2],["E-mail",row.email]]}/></PrintSection><PrintSection title="Condições Comerciais"><PrintGrid items={[["Condição de Pagamento",row.condicao_pagamento],["Limite de Crédito",formatCurrency(row.credit_limit)]]}/></PrintSection><div style={printStyles.footer}>Documento gerado pelo ProdOS · {new Date().toLocaleString("pt-BR")}</div></section>; }
function PrintSection({ title, children }) { return <div style={printStyles.section}><h2 style={printStyles.sectionTitle}>{title}</h2>{children}</div>; }
function PrintGrid({ items }) { return <div style={printStyles.grid}>{items.map(([label,value]) => <div key={label} style={printStyles.item}><span style={printStyles.label}>{label}</span><strong style={printStyles.value}>{value || "—"}</strong></div>)}</div>; }
function formatCurrency(v) { return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`; }
function statusStyle(status) { const base = { display:"inline-block", padding:"4px 9px", borderRadius:999, fontSize:11, fontWeight:700 }; if (status === "Inativo") return { ...base, background:"#FDE8E7", color:"#A53B34" }; if (status === "Bloqueado") return { ...base, background:"#FFF0D8", color:"#8A5A00" }; return { ...base, background:"#E6F5EC", color:"#24754C" }; }

const styles = { header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:18}, title:{fontFamily:"var(--font-display)",fontSize:22,margin:0}, subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0"}, headerActions:{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}, addBtn:{background:"var(--amber)",color:"#fff",border:0,borderRadius:"var(--radius)",padding:"10px 16px",fontWeight:700,cursor:"pointer"}, printBtn:{background:"var(--panel)",color:"var(--amber)",border:"1px solid var(--amber)",borderRadius:"var(--radius)",padding:"10px 14px",fontWeight:700,cursor:"pointer"}, listToolbar:{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}, searchWrap:{display:"flex",alignItems:"center",gap:8,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"0 10px",flex:"1 1 280px"}, search:{border:0,outline:0,background:"transparent",padding:"10px 4px",width:"100%",color:"var(--text)"}, selectBtn:{background:"var(--panel)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:"var(--radius)",padding:"10px 14px",fontWeight:600,cursor:"pointer"}, form:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:18,marginBottom:18}, formHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}, formHint:{color:"var(--text-dim)",fontSize:12,marginTop:4}, closeBtn:{background:"transparent",border:0,color:"var(--text-dim)",cursor:"pointer"}, section:{borderTop:"1px solid var(--line)",paddingTop:14,marginTop:14}, sectionTitle:{fontSize:13,margin:"0 0 12px",color:"var(--text)"}, grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}, field:{display:"flex",flexDirection:"column",gap:6,fontSize:12,fontWeight:600,color:"var(--text-dim)"}, input:{width:"100%",boxSizing:"border-box",background:"var(--panel-2)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"9px 10px",color:"var(--text)",fontSize:13}, codeBox:{width:"100%",boxSizing:"border-box",background:"var(--field)",border:"1px dashed var(--line)",borderRadius:"var(--radius)",padding:"9px 10px",color:"var(--text-dim)",fontSize:13}, help:{color:"var(--text-dim)",fontWeight:400}, formActions:{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}, cancelBtn:{background:"transparent",border:"1px solid var(--line)",color:"var(--text-dim)",borderRadius:"var(--radius)",padding:"9px 16px",cursor:"pointer"}, saveBtn:{background:"var(--green)",color:"#fff",border:0,borderRadius:"var(--radius)",padding:"9px 16px",fontWeight:700,cursor:"pointer"}, selectionBar:{fontSize:12,color:"var(--text-dim)",margin:"10px 0",display:"flex",gap:8,alignItems:"center"}, linkBtn:{background:"none",border:0,color:"var(--amber)",cursor:"pointer",padding:0}, tableWrap:{border:"1px solid var(--line)",borderRadius:"var(--radius)",overflow:"hidden"}, table:{width:"100%",borderCollapse:"collapse"}, checkTh:{width:42,padding:"10px 12px",background:"var(--panel)",borderBottom:"1px solid var(--line)"}, th:{textAlign:"left",fontSize:11,textTransform:"uppercase",color:"var(--text-dim)",padding:"10px 12px",background:"var(--panel)",borderBottom:"1px solid var(--line)"}, td:{padding:"10px 12px",fontSize:13,background:"var(--panel)",borderBottom:"1px solid var(--line)"}, editBtn:{background:"transparent",border:0,color:"var(--amber)",fontWeight:700,cursor:"pointer",marginRight:8}, deleteBtn:{background:"transparent",border:0,color:"#C0392B",fontWeight:700,cursor:"pointer"}, error:{background:"#FDE8E7",color:"#A53B34",padding:"10px 12px",borderRadius:"var(--radius)",marginBottom:12,fontSize:13}, dim:{color:"var(--text-dim)"} };
const printStyles = { page:{fontFamily:"Arial,sans-serif",color:"#202833",padding:"8mm",background:"#fff"}, top:{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"2px solid #202833",paddingBottom:10}, logo:{width:120,height:"auto"}, doc:{fontSize:12,fontWeight:700,letterSpacing:.5}, company:{marginTop:18,fontSize:11,color:"#667384"}, heading:{fontSize:22,margin:"6px 0 2px"}, code:{fontSize:11,color:"#667384",margin:"0 0 16px"}, section:{marginTop:14}, sectionTitle:{fontSize:12,textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #CBD3DD",paddingBottom:5,margin:"0 0 8px"}, grid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}, item:{display:"flex",flexDirection:"column",gap:3}, label:{fontSize:9,color:"#667384"}, value:{fontSize:11}, footer:{marginTop:24,paddingTop:8,borderTop:"1px solid #CBD3DD",fontSize:9,color:"#667384",textAlign:"center"} };
