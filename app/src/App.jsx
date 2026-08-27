import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import ResetSenhaPage from "./pages/ResetSenhaPage";
import DashboardPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import ContatosPage from "./pages/ContatosPage";
import ProdutosPage from "./pages/ProdutosPage";
import EstruturaProdutoPage from "./pages/EstruturaProdutoPage";
import EtapasPage from "./pages/EtapasPage";
import CentrosTrabalhoPage from "./pages/CentrosTrabalhoPage";
import AlmoxarifadosPage from "./pages/AlmoxarifadosPage";
import UnidadesMedidaPage from "./pages/UnidadesMedidaPage";
import CondicoesPagamentoPage from "./pages/CondicoesPagamentoPage";
import CentrosCustoPage from "./pages/CentrosCustoPage";
import TransportadorasPage from "./pages/TransportadorasPage";
import ProducaoPage from "./pages/ProducaoPage";
import ImprimirOrdemProducaoPage from "./pages/ImprimirOrdemProducaoPage";
import ApontamentoProducaoPage from "./pages/ApontamentoProducaoPage";
import ParadasProducaoPage from "./pages/ParadasProducaoPage";
import TiposOrdemPage from "./pages/TiposOrdemPage";
import NecessidadeMateriaisPage from "./pages/NecessidadeMateriaisPage";
import CapacidadePage from "./pages/CapacidadePage";
import QualidadeChecklistPage from "./pages/QualidadeChecklistPage";
import QualidadeInspecaoPage from "./pages/QualidadeInspecaoPage";
import QualidadeNaoConformidadesPage from "./pages/QualidadeNaoConformidadesPage";
import EstoquePage from "./pages/EstoquePage";
import RecebimentoProducaoPage from "./pages/RecebimentoProducaoPage";
import ExpedicaoPage from "./pages/ExpedicaoPage";
import TransferenciasPage from "./pages/TransferenciasPage";
import HistoricoMovimentacoesPage from "./pages/HistoricoMovimentacoesPage";
import ContasReceberPage from "./pages/ContasReceberPage";
import CustosPage from "./pages/CustosPage";
import ColaboradoresPage from "./pages/ColaboradoresPage";
import JornadasTrabalhoPage from "./pages/JornadasTrabalhoPage";
import FeriasPage from "./pages/FeriasPage";
import FolhaPagamentoPage from "./pages/FolhaPagamentoPage";
import DecimoTerceiroPage from "./pages/DecimoTerceiroPage";
import RescisaoPage from "./pages/RescisaoPage";
import BeneficiosPage from "./pages/BeneficiosPage";
import EmpresaPage from "./pages/EmpresaPage";
import UsuariosPage from "./pages/UsuariosPage";
import SuportePage from "./pages/SuportePage";
import MeusDadosLGPDPage from "./pages/MeusDadosLGPDPage";
import PrivacidadePage from "./pages/PrivacidadePage";
import TermosPage from "./pages/TermosPage";
import SolicitarDemoPage from "./pages/SolicitarDemoPage";
import PagamentoPendentePage from "./pages/PagamentoPendentePage";
import AssinaturaPage from "./pages/AssinaturaPage";
import PlanoContasPage from "./pages/PlanoContasPage";
import SACPage from "./pages/SACPage";
import NotasFiscaisPage from "./pages/NotasFiscaisPage";
import FiscalPage from "./pages/FiscalPage";
import FrotasPage from "./pages/FrotasPage";
import RelatorioVendasPage from "./pages/RelatorioVendasPage";
import RelatorioComprasPage from "./pages/RelatorioComprasPage";
import RelatorioEstoqueAcabadoPage from "./pages/RelatorioEstoqueAcabadoPage";
import RelatorioEstoqueMateriaisPage from "./pages/RelatorioEstoqueMateriaisPage";
import RelatorioAlmoxarifadoPage from "./pages/RelatorioAlmoxarifadoPage";
import RelatorioProducaoPage from "./pages/RelatorioProducaoPage";
import CurvaABCPage from "./pages/CurvaABCPage";
import RelatorioQualidadePage from "./pages/RelatorioQualidadePage";
import RelatorioFinanceiroPage from "./pages/RelatorioFinanceiroPage";
import RelatorioRHPage from "./pages/RelatorioRHPage";
import RelatorioFiscalPage from "./pages/RelatorioFiscalPage";
import ContasPagarPage from "./pages/ContasPagarPage";
import LancamentosPage from "./pages/LancamentosPage";
import FluxoCaixaPage from "./pages/FluxoCaixaPage";
import TesourariaPage from "./pages/TesourariaPage";
import CreditoCobrancaPage from "./pages/CreditoCobrancaPage";
import AnaliseCentroCustoPage from "./pages/AnaliseCentroCustoPage";
import DREPage from "./pages/DREPage";
import CotacoesPage from "./pages/CotacoesPage";
import SugestoesCompraPage from "./pages/SugestoesCompraPage";
import PedidosCompraPage from "./pages/PedidosCompraPage";
import ImportarXmlNfePage from "./pages/ImportarXmlNfePage";
import AlmoxarifadoPage from "./pages/AlmoxarifadoPage";
import RequisicaoMaterialPage from "./pages/RequisicaoMaterialPage";
import LocalizacoesAlmoxarifadoPage from "./pages/LocalizacoesAlmoxarifadoPage";
import OportunidadesPage from "./pages/OportunidadesPage";
import EtapasComercialPage from "./pages/EtapasComercialPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import PedidosVendaPage from "./pages/PedidosVendaPage";
import "./theme.css";

function PrivateArea() {
  const { session, profile, company, loading, profileLoading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;

  // Espera profile/company terminarem de carregar antes de decidir
  // qualquer coisa — sem isso, a tela normal pisca por uma fração de
  // segundo antes do bloqueio de aprovação aparecer.
  if (profileLoading) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Carregando...</div>;
  }

  // Trava o sistema inteiro até o primeiro pagamento ser confirmado —
  // não existe mais período de teste. Admin da plataforma sempre entra,
  // pra conseguir dar suporte mesmo em empresas ainda não pagantes.
  if (profile && !profile.is_platform_admin && company && company.subscription_status !== "active") {
    return <PagamentoPendentePage status={company.subscription_status} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/contatos" element={<ContatosPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/estrutura-produto" element={<EstruturaProdutoPage />} />
        <Route path="/etapas" element={<EtapasPage />} />
        <Route path="/centros-trabalho" element={<CentrosTrabalhoPage />} />
        <Route path="/almoxarifados" element={<AlmoxarifadosPage />} />
        <Route path="/unidades-medida" element={<UnidadesMedidaPage />} />
        <Route path="/condicoes-pagamento" element={<CondicoesPagamentoPage />} />
        <Route path="/centros-custo" element={<CentrosCustoPage />} />
        <Route path="/transportadoras" element={<TransportadorasPage />} />
        <Route path="/producao" element={<ProducaoPage />} />
        <Route path="/imprimir-ordem-producao" element={<ImprimirOrdemProducaoPage />} />
        <Route path="/apontamento-producao" element={<ApontamentoProducaoPage />} />
        <Route path="/paradas-producao" element={<ParadasProducaoPage />} />
        <Route path="/tipos-ordem" element={<TiposOrdemPage />} />
        <Route path="/mrp/materiais" element={<NecessidadeMateriaisPage />} />
        <Route path="/mrp/capacidade" element={<CapacidadePage />} />
        <Route path="/qualidade/checklist" element={<QualidadeChecklistPage />} />
        <Route path="/qualidade/inspecao" element={<QualidadeInspecaoPage />} />
        <Route path="/qualidade/nao-conformidades" element={<QualidadeNaoConformidadesPage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/recebimento-producao" element={<RecebimentoProducaoPage />} />
        <Route path="/expedicao" element={<ExpedicaoPage />} />
        <Route path="/transferencias" element={<TransferenciasPage />} />
        <Route path="/historico-movimentacoes" element={<HistoricoMovimentacoesPage />} />
        <Route path="/cotacoes" element={<CotacoesPage />} />
        <Route path="/sugestoes-compra" element={<SugestoesCompraPage />} />
        <Route path="/pedidos-compra" element={<PedidosCompraPage />} />
        <Route path="/importar-xml-nfe" element={<ImportarXmlNfePage />} />
        <Route path="/almoxarifado" element={<AlmoxarifadoPage />} />
        <Route path="/requisicao-material" element={<RequisicaoMaterialPage />} />
        <Route path="/localizacoes-almoxarifado" element={<LocalizacoesAlmoxarifadoPage />} />
        <Route path="/oportunidades" element={<OportunidadesPage />} />
        <Route path="/etapas-comercial" element={<EtapasComercialPage />} />
        <Route path="/orcamentos" element={<OrcamentosPage />} />
        <Route path="/pedidos-venda" element={<PedidosVendaPage />} />
        <Route path="/contas-receber" element={<ContasReceberPage />} />
        <Route path="/custos-margem" element={<CustosPage />} />
        <Route path="/colaboradores" element={<ColaboradoresPage />} />
        <Route path="/jornadas-trabalho" element={<JornadasTrabalhoPage />} />
        <Route path="/ferias" element={<FeriasPage />} />
        <Route path="/folha-pagamento" element={<FolhaPagamentoPage />} />
        <Route path="/decimo-terceiro" element={<DecimoTerceiroPage />} />
        <Route path="/rescisao" element={<RescisaoPage />} />
        <Route path="/beneficios" element={<BeneficiosPage />} />
        <Route path="/empresa" element={<EmpresaPage />} />
        <Route path="/fiscal" element={<FiscalPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/suporte" element={<SuportePage />} />
        <Route path="/meus-dados-lgpd" element={<MeusDadosLGPDPage />} />
        <Route path="/assinatura" element={<AssinaturaPage />} />
        <Route path="/plano-contas" element={<PlanoContasPage />} />
        <Route path="/sac" element={<SACPage />} />
        <Route path="/notas-fiscais" element={<NotasFiscaisPage />} />
        <Route path="/frotas" element={<FrotasPage />} />
        <Route path="/relatorio-vendas" element={<RelatorioVendasPage />} />
        <Route path="/relatorio-compras" element={<RelatorioComprasPage />} />
        <Route path="/relatorio-estoque-acabado" element={<RelatorioEstoqueAcabadoPage />} />
        <Route path="/relatorio-estoque-materiais" element={<RelatorioEstoqueMateriaisPage />} />
        <Route path="/relatorio-almoxarifado" element={<RelatorioAlmoxarifadoPage />} />
        <Route path="/relatorio-producao" element={<RelatorioProducaoPage />} />
        <Route path="/curva-abc" element={<CurvaABCPage />} />
        <Route path="/relatorio-qualidade" element={<RelatorioQualidadePage />} />
        <Route path="/relatorio-financeiro" element={<RelatorioFinanceiroPage />} />
        <Route path="/relatorio-rh" element={<RelatorioRHPage />} />
        <Route path="/relatorio-fiscal" element={<RelatorioFiscalPage />} />
        <Route path="/contas-pagar" element={<ContasPagarPage />} />
        <Route path="/lancamentos" element={<LancamentosPage />} />
        <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />
        <Route path="/tesouraria" element={<TesourariaPage />} />
        <Route path="/credito-cobranca" element={<CreditoCobrancaPage />} />
        <Route path="/analise-centro-custo" element={<AnaliseCentroCustoPage />} />
        <Route path="/dre" element={<DREPage />} />
      </Route>
    </Routes>
  );
}

function RootRoutes() {
  const { session, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!loading && session ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/cadastro" element={!loading && session ? <Navigate to="/" replace /> : <AuthPage initialMode="signup" />} />
      <Route path="/reset-senha" element={<ResetSenhaPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      <Route path="/termos" element={<TermosPage />} />
      <Route path="/demo" element={<SolicitarDemoPage />} />
      <Route path="/*" element={<PrivateArea />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RootRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
