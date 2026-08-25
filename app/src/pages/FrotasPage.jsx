import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import ModulePage from "../components/ModulePage";

export default function FrotasPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="fleet_assets"
        title="Frotas e Equipamentos"
        subtitle="Veículos, máquinas e ferramentas — com histórico de manutenção"
        emptyLabel="Nenhum ativo cadastrado ainda."
        fields={[
          { key: "name", label: "Nome", placeholder: "Ex: Caminhão Munck, Furadeira industrial", required: true },
          { key: "asset_type", label: "Tipo", type: "select", required: true, options: ["veiculo", "equipamento", "ferramenta"] },
          { key: "identifier", label: "Placa / Nº de série / Patrimônio" },
          { key: "status", label: "Status", type: "select", options: ["ativo", "manutencao", "inativo"], quickEdit: true },
          { key: "acquisition_date", label: "Data de aquisição", type: "date" },
        ]}
      />
      <MaintenanceEditor onChange={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

function MaintenanceEditor({ onChange }) {
  const { company } = useAuth();
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState("");
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");

  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [nextDate, setNextDate] = useState("");

  async function loadAssets() {
    const { data } = await supabase.from("fleet_assets").select("id, name").order("name");
    setAssets(data ?? []);
  }

  async function loadRecords(aid) {
    if (!aid) { setRecords([]); return; }
    const { data } = await supabase
      .from("maintenance_records")
      .select("id, maintenance_date, description, cost, next_maintenance_date, status")
      .eq("asset_id", aid)
      .order("maintenance_date", { ascending: false });
    setRecords(data ?? []);
  }

  useEffect(() => {
    if (company?.id) loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadRecords(assetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function addRecord(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !assetId || !maintenanceDate) return;
    const { error } = await supabase.from("maintenance_records").insert({
      company_id: company.id,
      asset_id: assetId,
      maintenance_date: maintenanceDate,
      description,
      cost: Number(cost || 0),
      next_maintenance_date: nextDate || null,
    });
    if (error) setError(error.message);
    else {
      setMaintenanceDate(""); setDescription(""); setCost(""); setNextDate("");
      loadRecords(assetId);
      onChange();
    }
  }

  async function removeRecord(id) {
    if (!(await confirmDelete(company))) return;
    await supabase.from("maintenance_records").delete().eq("id", id);
    loadRecords(assetId);
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Manutenções</h2>
      <p style={styles.subtitle}>Histórico de manutenção de cada ativo, com custo e próxima data prevista.</p>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Ativo</span>
        <select style={styles.input} value={assetId} onChange={(e) => setAssetId(e.target.value)} onFocus={loadAssets}>
          <option value="">Selecione...</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>

      {assetId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={addRecord} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Data</span>
              <input style={styles.input} type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} required />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Descrição</span>
              <input style={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Troca de óleo" />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Custo (R$)</span>
              <input style={styles.input} type="number" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Próxima manutenção</span>
              <input style={styles.input} type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </label>
            <button style={styles.addBtn} type="submit">+ Registrar</button>
          </form>

          {records.length === 0 ? (
            <p style={styles.dim}>Nenhuma manutenção registrada ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>Data</th><th style={styles.th}>Descrição</th><th style={styles.th}>Custo</th><th style={styles.th}>Próxima</th><th style={styles.th}></th></tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{new Date(r.maintenance_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td style={styles.td}>{r.description ?? "—"}</td>
                      <td style={styles.td}>R$ {Number(r.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={styles.td}>{r.next_maintenance_date ? new Date(r.next_maintenance_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button style={styles.deleteBtn} onClick={() => removeRecord(r.id)} type="button">Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 620, lineHeight: 1.5 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxWidth: 320 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 18,
  },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 760 },
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
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 760,
  },
};
