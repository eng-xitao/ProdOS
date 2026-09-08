import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function EmpresaPage() {
  const { company, refreshCompany } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        segment: company.segment ?? "",
        cnpj: company.cnpj ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        logo_url: company.logo_url ?? "",
        delete_pin: company.delete_pin ?? "",
        cost_method: company.cost_method ?? "medio_ponderado",
        cost_method_window_days: company.cost_method_window_days ?? 180,
        sale_price_mode: company.sale_price_mode ?? "manual",
        default_sale_margin_percent: company.default_sale_margin_percent ?? "",
      });
    }
  }, [company]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const payload = {
      ...form,
      cost_method_window_days: Number(form.cost_method_window_days || 180),
      default_sale_margin_percent:
        form.default_sale_margin_percent === "" || form.default_sale_margin_percent === null
          ? null
          : Number(form.default_sale_margin_percent),
    };

    const { error } = await supabase.from("companies").update(payload).eq("id", company.id);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      await refreshCompany();
    }
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Dados da Empresa</h1>
        <p style={styles.subtitle}>
          Essas informações aparecem no cabeçalho do sistema e podem ser usadas em documentos
          como orçamentos e pedidos.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>Dados salvos com sucesso.</div>}

      <form onSubmit={handleSave} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Nome da empresa</span>
          <input style={styles.input} value={form.name ?? ""} onChange={(e) => updateField("name", e.target.value)} required />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Segmento</span>
          <input style={styles.input} value={form.segment ?? ""} onChange={(e) => updateField("segment", e.target.value)} placeholder="Ex: Metalurgia, varejo, serviços..." />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>CNPJ</span>
          <input style={styles.input} value={form.cnpj ?? ""} onChange={(e) => updateField("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Endereço</span>
          <input style={styles.input} value={form.address ?? ""} onChange={(e) => updateField("address", e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Telefone</span>
          <input style={styles.input} value={form.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="(11) 90000-0000" />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>E-mail</span>
          <input style={styles.input} type="email" value={form.email ?? ""} onChange={(e) => updateField("email", e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>URL do logo</span>
          <input style={styles.input} value={form.logo_url ?? ""} onChange={(e) => updateField("logo_url", e.target.value)} placeholder="https://..." />
          <span style={styles.fieldHint}>Aparece nos documentos impressos (Orçamento, Pedido, Romaneio, Ordem de Produção).</span>
        </label>

        <div style={styles.pinBox}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>PIN de exclusão (opcional)</span>
            <input
              style={styles.input}
              value={form.delete_pin ?? ""}
              onChange={(e) => updateField("delete_pin", e.target.value)}
              placeholder="Ex: 4821"
            />
            <span style={styles.fieldHint}>
              Se preenchido, o sistema passa a pedir esse PIN antes de excluir qualquer coisa (em qualquer
              tela). Compartilhe só com quem você confia pra apagar dados. Deixe em branco pra usar apenas
              a confirmação simples.
            </span>
          </label>
        </div>

        <div style={styles.sectionBreak}>
          <h2 style={styles.sectionTitle}>Custos e Precificação</h2>
          <p style={styles.sectionSubtitle}>
            Define como o ProdOS calcula automaticamente o custo dos seus materiais e, se desejar,
            sugere o preço de venda dos produtos acabados. Isso vale pra toda a empresa — o cadastro
            de produto continua o mesmo, só a regra por trás muda.
          </p>
        </div>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>Método de custo dos materiais</span>
          <select style={styles.input} value={form.cost_method ?? "medio_ponderado"} onChange={(e) => updateField("cost_method", e.target.value)}>
            <option value="medio_ponderado">Custo médio ponderado (todas as compras)</option>
            <option value="ultima_compra">Última compra recebida</option>
            <option value="media_movel">Média móvel (últimos X dias)</option>
          </select>
          <span style={styles.fieldHint}>
            {form.cost_method === "ultima_compra" && "O custo passa a ser sempre o preço da compra mais recente recebida — reage rápido a mudanças de mercado."}
            {form.cost_method === "media_movel" && "A média considera só as compras dentro da janela de dias definida abaixo, evitando que preços muito antigos distorçam o custo atual."}
            {(form.cost_method === "medio_ponderado" || !form.cost_method) && "Padrão recomendado: estável e usado pela maioria dos ERPs no Brasil. Considera todas as compras já recebidas."}
          </span>
        </label>

        {form.cost_method === "media_movel" && (
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Janela da média móvel (dias)</span>
            <input style={styles.input} type="number" min="1" step="1" value={form.cost_method_window_days ?? 180} onChange={(e) => updateField("cost_method_window_days", e.target.value)} />
            <span style={styles.fieldHint}>Ex.: 180 considera só compras dos últimos 6 meses.</span>
          </label>
        )}

        <label style={styles.field}>
          <span style={styles.fieldLabel}>Preço de venda de produtos acabados</span>
          <select style={styles.input} value={form.sale_price_mode ?? "manual"} onChange={(e) => updateField("sale_price_mode", e.target.value)}>
            <option value="manual">Sempre manual</option>
            <option value="sugestao_automatica">Sugerir automaticamente por margem</option>
          </select>
          <span style={styles.fieldHint}>
            {form.sale_price_mode === "sugestao_automatica"
              ? "O sistema pré-calcula o preço com base no custo + margem sempre que o custo for atualizado. Você continua podendo editar o valor final a qualquer momento."
              : "Quem cadastra o produto define o preço de venda manualmente, sem sugestão automática."}
          </span>
        </label>

        {form.sale_price_mode === "sugestao_automatica" && (
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Margem padrão (%)</span>
            <input style={styles.input} type="number" min="0" max="99.99" step="0.01" value={form.default_sale_margin_percent ?? ""} onChange={(e) => updateField("default_sale_margin_percent", e.target.value)} placeholder="Ex.: 35" />
            <span style={styles.fieldHint}>Usada como ponto de partida quando o produto não tem uma margem própria definida no cadastro.</span>
          </label>
        )}

        <button style={styles.saveBtn} type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 620, lineHeight: 1.5 },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 24, marginTop: 20, maxWidth: 760,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  fieldHint: { fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.4 },
  sectionBreak: { gridColumn: "1 / -1", marginTop: 10, paddingTop: 18, borderTop: "1px solid var(--line)" },
  sectionTitle: { fontFamily: "var(--font-display)", fontSize: 16, margin: 0 },
  sectionSubtitle: { color: "var(--text-dim)", fontSize: 12.5, margin: "6px 0 0", lineHeight: 1.5 },
  pinBox: {
    marginTop: 8, padding: 14, background: "rgba(232,163,61,0.08)",
    border: "1px dashed var(--amber)", borderRadius: "var(--radius)",
  },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  saveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 42, gridColumn: "1 / -1", justifySelf: "start",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
  success: {
    background: "rgba(79,174,126,0.12)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};
