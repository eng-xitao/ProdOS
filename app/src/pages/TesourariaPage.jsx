import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import CurrencyInput from "../components/CurrencyInput";

const TYPE_LABEL = { caixa: "Caixa físico", banco: "Conta bancária", aplicacao: "Aplicação" };
const MOVEMENT_LABEL = {
  aporte: "Aporte / Depósito",
  retirada: "Retirada",
  rendimento: "Rendimento",
  transferencia_saida: "Transferência entre contas",
};

/**
 * Tesouraria: controla o saldo de cada conta (caixa físico, contas
 * bancárias e aplicações) através de movimentações — aportes,
 * retiradas, rendimentos e transferências entre contas. O saldo de
 * cada conta é sempre calculado (saldo inicial + soma das
 * movimentações), nunca digitado diretamente.
 */
export default function TesourariaPage() {
  const { company } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("banco");
  const [accOpening, setAccOpening] = useState(0);

  const [movAccountId, setMovAccountId] = useState("");
  const [movType, setMovType] = useState("aporte");
  const [movRelatedId, setMovRelatedId] = useState("");
  const [movAmount, setMovAmount] = useState(0);
  const [movDate, setMovDate] = useState(new Date().toISOString().slice(0, 10));
  const [movDescription, setMovDescription] = useState("");

  async function loadAll() {
    setLoading(true);
    const [{ data: acc }, { data: mov }] = await Promise.all([
      supabase.from("treasury_accounts").select("id, name, type, opening_balance, active").eq("active", true).order("name"),
      supabase
        .from("treasury_movements")
        .select("id, movement_type, amount, movement_date, description, account_id, related_account_id, treasury_accounts:account_id (name)")
        .order("movement_date", { ascending: false }),
    ]);
    setAccounts(acc ?? []);
    setMovements(mov ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const balances = useMemo(() => {
    const map = Object.fromEntries(accounts.map((a) => [a.id, Number(a.opening_balance)]));
    movements.forEach((m) => {
      const amount = Number(m.amount);
      const isOutflow = m.movement_type === "retirada" || m.movement_type === "transferencia_saida";
      if (map[m.account_id] !== undefined) map[m.account_id] += isOutflow ? -amount : amount;
      if (m.movement_type === "transferencia_saida" && m.related_account_id && map[m.related_account_id] !== undefined) {
        map[m.related_account_id] += amount;
      }
    });
    return map;
  }, [accounts, movements]);

  const totalGeral = accounts.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);

  async function createAccount(e) {
    e.preventDefault();
    if (!company?.id || !accName) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("treasury_accounts").insert({
      company_id: company.id, name: accName, type: accType, opening_balance: accOpening,
    });
    if (error) setError(error.message);
    else { setAccName(""); setAccType("banco"); setAccOpening(0); setShowAccountForm(false); loadAll(); }
    setSaving(false);
  }

  async function createMovement(e) {
    e.preventDefault();
    if (!company?.id || !movAccountId || !movAmount) return;
    setSaving(true);
    setError("");

    if (movType === "transferencia_saida" && (!movRelatedId || movRelatedId === movAccountId)) {
      setError("Escolha uma conta de destino diferente da conta de origem.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("treasury_movements").insert({
      company_id: company.id,
      account_id: movAccountId,
      related_account_id: movType === "transferencia_saida" ? movRelatedId : null,
      movement_type: movType,
      amount: movAmount,
      movement_date: movDate,
      description: movDescription || null,
    });

    if (error) setError(error.message);
    else {
      setMovAccountId(""); setMovType("aporte"); setMovRelatedId("");
      setMovAmount(0); setMovDescription("");
      loadAll();
    }
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Tesouraria</h1>
        <p style={styles.subtitle}>
          Caixa físico, contas bancárias e aplicações da empresa. O saldo de cada conta é sempre
          calculado a partir das movimentações — nunca digitado direto.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.totalBox}>
        <span style={styles.totalLabel}>Saldo total em tesouraria</span>
        <span style={styles.totalValue}>R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>

      <div style={styles.accountsGrid}>
        {accounts.map((a) => (
          <div key={a.id} style={styles.accountCard}>
            <span style={styles.accountType}>{TYPE_LABEL[a.type]}</span>
            <span style={styles.accountName}>{a.name}</span>
            <span style={styles.accountBalance}>
              R$ {(balances[a.id] ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        <button style={styles.addAccountCard} onClick={() => setShowAccountForm((v) => !v)} type="button">
          {showAccountForm ? "Cancelar" : "+ Nova conta"}
        </button>
      </div>

      {showAccountForm && (
        <form onSubmit={createAccount} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Nome da conta</span>
            <input style={styles.input} value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="Ex: Caixa loja, Banco Itaú, CDB Itaú" required />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Tipo</span>
            <select style={styles.input} value={accType} onChange={(e) => setAccType(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Saldo inicial</span>
            <CurrencyInput value={accOpening} onChange={setAccOpening} />
          </label>
          <button style={styles.submitBtn} type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar conta"}</button>
        </form>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Nova movimentação</h2>
        <form onSubmit={createMovement} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Conta {movType === "transferencia_saida" ? "de origem" : ""}</span>
            <select style={styles.input} value={movAccountId} onChange={(e) => setMovAccountId(e.target.value)} required>
              <option value="">Selecione...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Tipo</span>
            <select style={styles.input} value={movType} onChange={(e) => setMovType(e.target.value)}>
              {Object.entries(MOVEMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {movType === "transferencia_saida" && (
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Conta de destino</span>
              <select style={styles.input} value={movRelatedId} onChange={(e) => setMovRelatedId(e.target.value)} required>
                <option value="">Selecione...</option>
                {accounts.filter((a) => a.id !== movAccountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Valor</span>
            <CurrencyInput value={movAmount} onChange={setMovAmount} />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Data</span>
            <input style={styles.input} type="date" value={movDate} onChange={(e) => setMovDate(e.target.value)} required />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Descrição</span>
            <input style={styles.input} value={movDescription} onChange={(e) => setMovDescription(e.target.value)} placeholder="Opcional" />
          </label>
          <button style={styles.submitBtn} type="submit" disabled={saving || !accounts.length}>
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </form>
        {!accounts.length && !loading && (
          <p style={styles.dim}>Crie ao menos uma conta acima antes de registrar movimentações.</p>
        )}
      </div>

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico de movimentações</h2>
        {loading ? (
          <p style={styles.dim}>Carregando...</p>
        ) : movements.length === 0 ? (
          <p style={styles.dim}>Nenhuma movimentação registrada ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Conta</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Descrição</th>
                  <th style={styles.th}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={styles.td}>{new Date(m.movement_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td style={styles.td}>{m.treasury_accounts?.name}</td>
                    <td style={styles.td}>{MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}</td>
                    <td style={styles.td}>{m.description ?? "—"}</td>
                    <td style={{
                      ...styles.td, fontWeight: 700,
                      color: m.movement_type === "retirada" || m.movement_type === "transferencia_saida" ? "var(--red)" : "var(--green)",
                    }}>
                      {m.movement_type === "retirada" || m.movement_type === "transferencia_saida" ? "− " : "+ "}
                      R$ {Number(m.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
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
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  totalBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "14px 20px", marginBottom: 20, maxWidth: 900,
  },
  totalLabel: { fontSize: 13, color: "var(--text-dim)", fontWeight: 600 },
  totalValue: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--amber)" },
  accountsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, maxWidth: 900 },
  accountCard: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, display: "flex", flexDirection: "column", gap: 4,
  },
  accountType: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  accountName: { fontSize: 14, fontWeight: 600 },
  accountBalance: { fontFamily: "var(--font-display)", fontSize: 18, color: "var(--amber)", marginTop: 4 },
  addAccountCard: {
    background: "var(--panel-2)", border: "1px dashed var(--line)", borderRadius: "var(--radius)",
    padding: 16, color: "var(--text-dim)", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginTop: 16, maxWidth: 900, alignItems: "end",
  },
  submitBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 900 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 900,
  },
};
