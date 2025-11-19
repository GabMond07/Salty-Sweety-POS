import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  History,
  LogOut,
  Menu,
  X,
  FileText,
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
    { path: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  ];

  const isActive = (path: string) => location.pathname === path;

  if (!user) return null;

  return (
    <nav className="fixed top-0 w-full z-50 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 text-gray-800 shadow-md border-b border-pink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-4">
            <img
              src="/logo.jpg"
              alt="Salty & Sweety Logo"
              className="w-14 h-14 object-contain rounded-lg"
            />
            {/* <div className="hidden md:block">
              <h1 className="text-xl font-bold text-gray-800">S&S</h1>
              <p className="text-sm text-purple-500 font-medium">
                Point of Sale
              </p>
            </div> */}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-5 py-3 rounded-xl transition-all duration-300 ease-in-out group ${
                  isActive(item.path)
                    ? "bg-pink-300 text-pink-700 shadow-lg scale-105"
                    : "text-gray-700 hover:bg-blue-100 hover:text-blue-600 hover:shadow-md"
                }`}
              >
                <item.icon className="w-5 h-5 group-hover:scale-110" />
                <span className="font-semibold text-sm tracking-wide">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          {/* User Info & Logout */}
          <div className="hidden md:flex items-center space-x-6">
            <div className="text-right pr-4">
              <p className="text-sm font-semibold text-gray-800">
                {/* {user.email} */}
              </p>
              <p className="text-xs text-purple-500">Bienvenido</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 bg-gradient-to-r from-pink-300 to-purple-300 hover:from-pink-400 hover:to-purple-400 text-gray-800 px-5 py-2 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Salir</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl hover:bg-blue-100 transition-colors duration-300"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-sm border-t border-blue-100 shadow-lg">
          <div className="px-4 pt-4 pb-6 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive(item.path)
                    ? "bg-pink-200 text-pink-700 shadow-md scale-105"
                    : "text-gray-700 hover:bg-purple-100 hover:text-purple-600 hover:shadow-sm"
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className="font-semibold text-base">{item.label}</span>
              </Link>
            ))}
            <div className="border-t border-purple-100 pt-4 mt-4">
              <div className="px-4 py-3 mb-3">
                <p className="text-sm font-semibold text-gray-800">
                  {user.email}
                </p>
                <p className="text-xs text-blue-500">Usuario activo</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-300 to-purple-300 hover:from-pink-400 hover:to-purple-400 text-gray-800 transition-all duration-300 shadow-sm font-medium"
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
