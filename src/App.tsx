import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Ventas from "./pages/Ventas";
import Productos from "./pages/Productos";
import HistorialVentas from "./pages/HistorialVentas";
import Clientes from "./pages/Clientes";
import Cotizaciones from "./pages/Cotizaciones";

function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {user && <Navbar />}
        <div className={user ? "pt-16" : ""}>
          <Routes>
            <Route
              path="/login"
              element={!user ? <Login /> : <Navigate to="/" />}
            />
            <Route
              path="/"
              element={user ? <Dashboard /> : <Navigate to="/login" />}
            />
            <Route
              path="/ventas"
              element={user ? <Ventas /> : <Navigate to="/login" />}
            />
            <Route
              path="/productos"
              element={user ? <Productos /> : <Navigate to="/login" />}
            />
            <Route
              path="/historial-ventas"
              element={user ? <HistorialVentas /> : <Navigate to="/login" />}
            />
            <Route
              path="/clientes"
              element={user ? <Clientes /> : <Navigate to="/login" />}
            />
            <Route
              path="/cotizaciones"
              element={user ? <Cotizaciones /> : <Navigate to="/login" />}
            />
            {/* Agrega más: /notas, /inventario */}
            <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
