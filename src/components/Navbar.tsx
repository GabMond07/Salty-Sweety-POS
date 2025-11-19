import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  FileText,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/ventas", label: "Nueva Venta", icon: ShoppingCart },
    { path: "/productos", label: "Productos", icon: Package },
    { path: "/historial-ventas", label: "Historial", icon: History },
    { path: "/clientes", label: "Clientes", icon: Users },
  ];

  const isActive = (path: string) => location.pathname === path;

  if (!user) return null;

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="bg-white p-2 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold">Salty & Sweety</h1>
              <p className="text-xs text-blue-100">Point of Sale</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  isActive(item.path)
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-white hover:bg-blue-700"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User Info & Logout */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-blue-100">Usuario</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Salir</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-blue-700"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-blue-700 border-t border-blue-500">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                  isActive(item.path)
                    ? "bg-white text-blue-600"
                    : "text-white hover:bg-blue-600"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
            <div className="border-t border-blue-500 pt-2 mt-2">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-blue-200">Usuario</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
