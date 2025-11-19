import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Ventas from "./pages/Ventas";
import Productos from "./pages/Productos";
// ... otras imports

function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
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
          {/* Agrega más: /clientes, /cotizaciones, /notas, /inventario */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
