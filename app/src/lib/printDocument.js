/**
 * Utilitário compartilhado pelos 4 documentos formais impressos
 * (Orçamento, Confirmação de Pedido, Ordem de Produção, Romaneio
 * de Expedição). Abre uma janela nova só com o documento — assim
 * não mistura com o resto da tela, e imprime/permite salvar em PDF.
 */

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 36px; margin: 0; }
  .bar { height: 6px; background: #C0602A; margin-bottom: 20px; }
  .head-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 14px; margin-bottom: 20px; }
  .company-name { font-weight: 700; font-size: 17px; }
  .detail { font-size: 11px; color: #333; }
  .doc-block { text-align: right; }
  .doc-title { font-family: 'Courier New', monospace; font-weight: 700; font-size: 20px; letter-spacing: 0.03em; margin-bottom: 6px; }
  .doc-meta { font-size: 12px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 18px 0 8px; letter-spacing: 0.03em; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #333; background: #eee; }
  td { font-size: 12px; padding: 8px 10px; border: 1px solid #333; }
  .totals-box { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals-inner { min-width: 260px; }
  .total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
  .total-row-final { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; padding: 8px 0; border-top: 2px solid #000; margin-top: 4px; }
  .notes-box { font-size: 12px; border: 1px solid #333; padding: 10px; margin-top: 16px; min-height: 50px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; gap: 40px; }
  .signature-line { flex: 1; text-align: center; border-top: 1px solid #000; padding-top: 6px; font-size: 12px; }
  .disclaimer { font-size: 10px; text-align: center; border: 1px solid #333; padding: 6px; margin-bottom: 16px; text-transform: uppercase; }
  @media print { body { padding: 16px; } }
`;

function brandHeader(company, docTitle, docMetaPairs) {
  const logo = company?.logo_url ? `<img src="${company.logo_url}" style="max-height:46px;display:block;margin-bottom:6px;" />` : "";
  const meta = docMetaPairs.map(([label, value]) => `<div class="doc-meta"><strong>${label}:</strong> ${value ?? "—"}</div>`).join("");
  return `
    <div class="bar"></div>
    <div class="head-row">
      <div>
        ${logo}
        <div class="company-name">${company?.name ?? "—"}</div>
        ${company?.cnpj ? `<div class="detail">CNPJ: ${company.cnpj}</div>` : ""}
        ${company?.address ? `<div class="detail">${company.address}</div>` : ""}
        ${company?.phone ? `<div class="detail">${company.phone}</div>` : ""}
      </div>
      <div class="doc-block">
        <div class="doc-title">${docTitle}</div>
        ${meta}
      </div>
    </div>
  `;
}

function openPrintWindow(title, bodyHtml) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente de novo.");
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>${CSS}</style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

function currency(v) {
  return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("pt-BR");
}

export { openPrintWindow, brandHeader, currency, formatDate };
