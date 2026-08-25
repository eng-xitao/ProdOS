import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Importar XML de NF-e (Compras): lê o XML da nota fiscal enviada
 * pelo fornecedor, identifica/cria o fornecedor pelo CNPJ, deixa a
 * pessoa mapear cada item do XML pra um produto já cadastrado, e
 * gera o Pedido de Compra automaticamente. Recurso vendido à parte
 * (add-on "XML-NFe") — não incluso em nenhum plano por padrão.
 */
export default function ImportarXmlNfePage() {
  const { company } = useAuth();
  const [parsed, setParsed] = useState(null);
  const [products, setProducts] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasAddon = (company?.addons ?? []).includes("XML-NFe");

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name").order("name");
    setProducts(data ?? []);
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("Arquivo XML inválido ou corrompido.");

    const infNFe = doc.querySelector("infNFe");
    if (!infNFe) throw new Error("Não encontrei os dados da nota (infNFe) nesse XML — confirma se é um XML de NF-e válido.");

    const get = (selector, root = doc) => root.querySelector(selector)?.textContent?.trim() ?? "";

    const emit = doc.querySelector("emit");
    const supplierCnpj = get("CNPJ", emit) || get("CPF", emit);
    const supplierName = get("xNome", emit);
    const supplierPhone = get("fone", emit.querySelector("enderEmit"));

    const chaveAcesso = infNFe.getAttribute("Id")?.replace("NFe", "") ?? "";
    const numero = get("nNF");
    const valorTotal = get("vNF");
    const dataEmissao = get("dhEmi") || get("dEmi");

    const items = Array.from(doc.querySelectorAll("det")).map((det) => ({
      codigo: get("cProd", det),
      descricao: get("xProd", det),
      ncm: get("NCM", det),
      quantidade: Number(get("qCom", det) || 0),
      valorUnitario: Number(get("vUnCom", det) || 0),
      valorTotal: Number(get("vProd", det) || 0),
    }));

    if (items.length === 0) throw new Error("Não encontrei itens (det) nesse XML.");

    return { supplierCnpj, supplierName, supplierPhone, chaveAcesso, numero, valorTotal, dataEmissao, items };
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setSuccess(false); setParsed(null);

    try {
      const text = await file.text();
      const data = parseXml(text);
      setParsed(data);
      setMapping({});
      await loadProducts();
    } catch (err) {
      setError(err.message ?? "Não foi possível ler esse XML.");
    }
  }

  async function handleCreatePurchaseOrder() {
    if (!parsed) return;
    const unmapped = parsed.items.filter((_, i) => !mapping[i]);
    if (unmapped.length > 0) {
      setError("Mapeie todos os itens pra um produto cadastrado antes de gerar o pedido.");
      return;
    }

    setCreating(true);
    setError("");

    // 1. Encontra ou cria o fornecedor pelo CNPJ
    const cleanCnpj = parsed.supplierCnpj.replace(/\D/g, "");
    let supplierId;

    const { data: existingSuppliers } = await supabase
      .from("suppliers")
      .select("id, document")
      .eq("company_id", company.id);
    const match = (existingSuppliers ?? []).find((s) => (s.document ?? "").replace(/\D/g, "") === cleanCnpj);

    if (match) {
      supplierId = match.id;
    } else {
      const { data: newSupplier, error: supplierError } = await supabase
        .from("suppliers")
        .insert({ company_id: company.id, name: parsed.supplierName, document: cleanCnpj, phone: parsed.supplierPhone || null })
        .select("id").single();
      if (supplierError) { setError(supplierError.message); setCreating(false); return; }
      supplierId = newSupplier.id;
    }

    // 2. Cria o Pedido de Compra
    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: company.id,
        supplier_id: supplierId,
        total_value: Number(parsed.valorTotal),
        status: "aberto",
      })
      .select("id, code").single();
    if (orderError) { setError(orderError.message); setCreating(false); return; }

    // 3. Cria os itens, usando o produto mapeado por linha
    const rows = parsed.items.map((it, i) => ({
      company_id: company.id,
      purchase_order_id: order.id,
      product_id: mapping[i],
      quantity: it.quantidade,
      unit_price: it.valorUnitario,
    }));
    await supabase.from("purchase_order_items").insert(rows);

    setCreating(false);
    setSuccess(true);
    setParsed(null);
  }

  if (!hasAddon) {
    return (
      <div style={styles.lockedBox}>
        <h1 style={styles.title}>Importar XML de NF-e</h1>
        <p style={styles.lockedText}>
          Esse recurso é um complemento vendido à parte — não está incluso no seu plano atual.
          Fale com o suporte se quiser habilitar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Importar XML de NF-e</h1>
        <p style={styles.subtitle}>
          Envie o XML da nota fiscal do fornecedor — o sistema identifica o fornecedor pelo CNPJ,
          e você só precisa dizer qual produto cadastrado corresponde a cada item, pra gerar o Pedido de Compra.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>Pedido de compra criado com sucesso a partir do XML!</div>}

      <label style={styles.fileBtn}>
        Escolher arquivo XML
        <input type="file" accept=".xml" onChange={handleFile} style={{ display: "none" }} />
      </label>

      {parsed && (
        <div style={styles.previewBox}>
          <h2 style={styles.title2}>Dados da nota</h2>
          <p style={styles.line}><strong>Fornecedor:</strong> {parsed.supplierName} (CNPJ {parsed.supplierCnpj})</p>
          <p style={styles.line}><strong>Nº da nota:</strong> {parsed.numero} · <strong>Valor total:</strong> R$ {Number(parsed.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>

          <h2 style={styles.title2}>Mapear itens ({parsed.items.length})</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Item no XML</th><th style={styles.th}>Qtd.</th><th style={styles.th}>Vlr. unit.</th><th style={styles.th}>Produto no ProdOS</th></tr>
              </thead>
              <tbody>
                {parsed.items.map((it, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{it.codigo} — {it.descricao}</td>
                    <td style={styles.td}>{it.quantidade}</td>
                    <td style={styles.td}>R$ {it.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={styles.td}>
                      <select
                        style={styles.select}
                        value={mapping[i] ?? ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                      >
                        <option value="">Selecione o produto...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button style={styles.confirmBtn} onClick={handleCreatePurchaseOrder} disabled={creating} type="button">
            {creating ? "Gerando..." : "Gerar Pedido de Compra"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 16, margin: "20px 0 10px" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  line: { fontSize: 13.5, margin: "4px 0" },
  fileBtn: {
    display: "inline-block", background: "var(--amber)", color: "#FFFFFF", borderRadius: "var(--radius)",
    padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 20,
  },
  previewBox: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, maxWidth: 800 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto", marginTop: 10 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 12px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid var(--line)" },
  select: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "6px 8px", color: "var(--text)", fontSize: 12.5, minWidth: 200,
  },
  confirmBtn: {
    marginTop: 16, background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
  success: {
    background: "rgba(79,174,126,0.1)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
  lockedBox: {
    background: "var(--panel)", border: "1px dashed var(--line)", borderRadius: "var(--radius)",
    padding: 30, maxWidth: 560,
  },
  lockedText: { color: "var(--text-dim)", fontSize: 13.5, lineHeight: 1.6, marginTop: 10 },
};
