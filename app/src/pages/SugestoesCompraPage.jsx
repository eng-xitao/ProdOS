import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Sugestões de Compra: geradas sozinhas pelo sistema sempre que o
 * estoque de um produto cruza o ponto de pedido (ou o estoque
 * mínimo, se ponto de pedido não estiver definido). Compras decide
 * o que fazer com cada uma — vira o início de uma Cotação, ou é
 * ignorada.
 */
export default function SugestoesCompraPage() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatingId, setCreatingId] = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("purchase_suggestions")
      .select("id, current_stock, threshold, suggested_quantity, status, created_at, products:product_id (id, sku, name, unit)")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    setSuggestions(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function createQuote(s) {
    setCreatingId(s.id);
    setError("");

    const quoteCode = `COT-AUTO-${Date.now().toString().slice(-6)}`;

    const { data: quote, error: quoteError } = await supabase
      .from("purchase_quotes")
      .insert({
        company_id: company.id,
        code: quoteCode,
        notes: `Gerada automaticamente — estoque de ${s.products?.sku} abaixo do ponto de pedido.`,
      })
      .select("id").single();

    if (quoteError) { setError(quoteError.message); setCreatingId(null); return; }

    await supabase.from("purchase_quote_items").insert({
      company_id: company.id,
      quote_id: quote.id,
      product_id: s.products.id,
      quantity: s.suggested_quantity,
    });

    await supabase.from("purchase_suggestions").update({ status: "atendida" }).eq("id", s.id);

    setCreatingId(null);
    navigate("/cotacoes");
  }

  async function dismiss(id) {
    await supabase.from("purchase_suggestions").update({ status: "ignorada" }).eq("id", id);
    load();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Sugestões de Compra</h1>
        <p style={styles.subtitle}>
          Geradas automaticamente sempre que o estoque de um produto cai abaixo do ponto de pedido cadastrado.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : suggestions.length === 0 ? (
        <p style={styles.dim}>Nenhuma sugestão pendente no momento — o estoque está dentro do esperado.</p>
      ) : (
        <div style={styles.list}>
          {suggestions.map((s) => (
            <div key={s.id} style={styles.card}>
              <div>
                <p style={styles.productName}>{s.products?.sku} — {s.products?.name}</p>
                <p style={styles.dim}>
                  Estoque atual: {Number(s.current_stock).toLocaleString("pt-BR")} {s.products?.unit} ·
                  {" "}Ponto de pedido: {Number(s.threshold).toLocaleString("pt-BR")} {s.products?.unit}
                </p>
                <p style={styles.suggestedQty}>
                  Sugestão: comprar {Number(s.suggested_quantity).toLocaleString("pt-BR")} {s.products?.unit}
                </p>
              </div>
              <div style={styles.actions}>
                <button style={styles.createBtn} onClick={() => createQuote(s)} disabled={creatingId === s.id} type="button">
                  {creatingId === s.id ? "Criando..." : "Iniciar Cotação"}
                </button>
                <button style={styles.dismissBtn} onClick={() => dismiss(s.id)} type="button">Ignorar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 600, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 12.5 },
  list: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 680 },
  card: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
    background: "var(--panel)", border: "1px solid var(--amber)", borderRadius: "var(--radius)", padding: 16,
  },
  productName: { fontWeight: 700, fontSize: 14, margin: "0 0 4px" },
  suggestedQty: { fontSize: 13, fontWeight: 700, color: "var(--amber)", margin: "6px 0 0" },
  actions: { display: "flex", flexDirection: "column", gap: 6 },
  createBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "8px 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
  },
  dismissBtn: {
    background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 16px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 640,
  },
};
