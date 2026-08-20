import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function ContatosPage() {
  const { company } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [ownerType, setOwnerType] = useState("customer"); // "customer" | "supplier"
  const [ownerId, setOwnerId] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function loadBaseData() {
    const [c, s] = await Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);
    setCustomers(c.data ?? []);
    setSuppliers(s.data ?? []);
  }

  async function loadContacts() {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department, email, phone, customers:customer_id (name), suppliers:supplier_id (name)")
      .order("name");
    setContacts(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadBaseData(); loadContacts(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function addContact(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !ownerId || !name) return;
    setSaving(true);

    const payload = {
      company_id: company.id,
      name,
      department: department || null,
      email: email || null,
      phone: phone || null,
      customer_id: ownerType === "customer" ? ownerId : null,
      supplier_id: ownerType === "supplier" ? ownerId : null,
    };

    const { error } = await supabase.from("contacts").insert(payload);
    if (error) setError(error.message);
    else {
      setOwnerId(""); setName(""); setDepartment(""); setEmail(""); setPhone("");
      loadContacts();
    }
    setSaving(false);
  }

  async function removeContact(id) {
    await supabase.from("contacts").delete().eq("id", id);
    loadContacts();
  }

  const ownerOptions = ownerType === "customer" ? customers : suppliers;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Contatos</h1>
        <p style={styles.subtitle}>
          Cada Cliente ou Fornecedor pode ter vários contatos, um por departamento
          (ex: Compras, Financeiro, Comercial) — usado para saber a quem enviar cada documento.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={addContact} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Vinculado a</span>
          <select style={styles.input} value={ownerType} onChange={(e) => { setOwnerType(e.target.value); setOwnerId(""); }}>
            <option value="customer">Cliente</option>
            <option value="supplier">Fornecedor</option>
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>{ownerType === "customer" ? "Cliente" : "Fornecedor"}</span>
          <select style={styles.input} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
            <option value="">Selecione...</option>
            {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Nome do contato</span>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Departamento</span>
          <input style={styles.input} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex: Compras" />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>E-mail</span>
          <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Telefone</span>
          <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button style={styles.addBtn} type="submit" disabled={saving}>{saving ? "Salvando..." : "+ Adicionar"}</button>
      </form>

      {contacts.length === 0 ? (
        <p style={styles.dim}>Nenhum contato cadastrado ainda.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>Vinculado a</th>
                <th style={styles.th}>Departamento</th>
                <th style={styles.th}>E-mail</th>
                <th style={styles.th}>Telefone</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>{c.customers?.name ?? c.suppliers?.name}</td>
                  <td style={styles.td}>{c.department ?? "—"}</td>
                  <td style={styles.td}>{c.email ?? "—"}</td>
                  <td style={styles.td}>{c.phone ?? "—"}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <button style={styles.deleteBtn} onClick={() => removeContact(c.id)} type="button">Excluir</button>
                  </td>
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
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 18, marginTop: 20, marginBottom: 20, alignItems: "end",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  addBtn: {
    background: "var(--green)", color: "#052014", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16,
  },
};
