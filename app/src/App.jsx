import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import ProdutosPage from "./pages/ProdutosPage";
import ProducaoPage from "./pages/ProducaoPage";
import EstoquePage from "./pages/EstoquePage";
import VendasPage from "./pages/VendasPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import "./theme.css";

function PrivateArea() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/producao" element={<ProducaoPage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
      </Route>
    </Routes>
  );
}

function RootRoutes() {
  const { session, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && session ? <Navigate to="/" replace /> : <AuthPage />}
      />
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
