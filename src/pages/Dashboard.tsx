import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Product } from "../types";
import {
  DollarSign,
  Package,
  Users,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Archive,
  FileText,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  // Query para ventas del día
  const { data: ventasHoy, isLoading: loadingVentasHoy } = useQuery({
    queryKey: ["ventasHoy"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ventas")
        .select("total")
        .gte("created_at", today);

      if (error) throw error;
      return data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;
    },
  });

  // Query para ventas del mes
  const { data: ventasMes, isLoading: loadingVentasMes } = useQuery({
    queryKey: ["ventasMes"],
    queryFn: async () => {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      const { data, error } = await supabase
        .from("ventas")
        .select("total")
        .gte("created_at", firstDayOfMonth.toISOString());

      if (error) throw error;
      return data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;
    },
  });

  // Query para productos con stock bajo
  const { data: stockBajo, isLoading: loadingStockBajo } = useQuery<Product[]>({
    queryKey: ["stockBajo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos").select("*");

      if (error) throw error;

      // Filtrar en el cliente productos con stock bajo
      return (data || []).filter(
        (producto) => producto.stock_actual <= producto.stock_minimo
      );
    },
  });

  // Query para total de clientes activos
  const { data: clientesActivos, isLoading: loadingClientes } = useQuery({
    queryKey: ["clientesActivos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
  });

  const metrics = [
    {
      title: "Ventas Hoy",
      value: `$${(ventasHoy || 0).toFixed(2)}`,
      icon: DollarSign,
      color: "bg-emerald-200",
      textColor: "text-emerald-800",
      loading: loadingVentasHoy,
    },
    {
      title: "Ventas del Mes",
      value: `$${(ventasMes || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: "bg-blue-200",
      textColor: "text-blue-800",
      loading: loadingVentasMes,
    },
    {
      title: "Stock Bajo",
      value: `${stockBajo?.length || 0} productos`,
      icon: AlertTriangle,
      color: "bg-red-200",
      textColor: "text-red-800",
      loading: loadingStockBajo,
      alert: (stockBajo?.length || 0) > 0,
    },
    {
      title: "Clientes Activos",
      value: clientesActivos || 0,
      icon: Users,
      color: "bg-purple-200",
      textColor: "text-purple-800",
      loading: loadingClientes,
    },
  ];

  const quickActions = [
    {
      title: "Nueva Venta",
      icon: ShoppingCart,
      color:
        "bg-gradient-to-br from-pink-200 to-pink-300 hover:from-pink-300 hover:to-pink-400 text-pink-800 shadow-md",
      path: "/ventas",
    },
    {
      title: "Inventario",
      icon: Package,
      color:
        "bg-gradient-to-br from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 shadow-md",
      path: "/productos",
    },
    {
      title: "Clientes",
      icon: Users,
      color:
        "bg-gradient-to-br from-purple-200 to-purple-300 hover:from-purple-300 hover:to-purple-400 text-purple-800 shadow-md",
      path: "/clientes",
    },
    {
      title: "Cotizaciones",
      icon: FileText,
      color:
        "bg-gradient-to-br from-amber-200 to-amber-300 hover:from-amber-300 hover:to-amber-400 text-amber-800 shadow-md",
      path: "/cotizaciones",
    },
    {
      title: "Historial Ventas",
      icon: FileText,
      color:
        "bg-gradient-to-br from-blue-200 to-blue-300 hover:from-blue-300 hover:to-blue-400 text-blue-800 shadow-md",
      path: "/historial-ventas",
    },
    {
      title: "Notas de Crédito",
      icon: FileText,
      color:
        "bg-gradient-to-br from-pink-200 to-purple-200 hover:from-pink-300 hover:to-purple-300 text-purple-800 shadow-md",
      path: "/notas",
    },
    {
      title: "Almacén",
      icon: Archive,
      color:
        "bg-gradient-to-br from-purple-200 to-blue-200 hover:from-purple-300 hover:to-blue-300 text-purple-800 shadow-md",
      path: "/almacen",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="mb-8 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 p-6 rounded-xl shadow-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          ¡Bienvenido a Salty & Sweety POS!
        </h1>
        <p className="text-gray-700 font-medium">
          Panel de control -{" "}
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl shadow-lg p-6 border-l-4 hover:shadow-xl transition-shadow ${
              metric.alert ? "border-red-200" : "border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600 mb-1">
                  {metric.title}
                </p>
                {metric.loading ? (
                  <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  <p className={`text-2xl font-bold ${metric.textColor}`}>
                    {metric.value}
                  </p>
                )}
              </div>
              <div className={`${metric.color} p-4 rounded-xl shadow-md`}>
                <metric.icon className={`w-6 h-6 ${metric.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
          <span>⚡</span>
          <span>Acciones Rápidas</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => navigate(action.path)}
              className={`${action.color} p-6 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-4`}
            >
              <action.icon className="w-8 h-8" />
              <span className="text-lg font-semibold">{action.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stock Bajo Alert */}
      {stockBajo && stockBajo.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border-l-4 border-red-200 p-6 rounded-xl shadow-lg">
          <div className="flex items-start">
            <div className="bg-red-200 p-3 rounded-xl mr-4">
              <AlertTriangle className="w-6 h-6 text-red-800" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 mb-2">
                ⚠️ Alerta de Inventario
              </h3>
              <p className="text-red-700 mb-3 font-medium">
                Los siguientes productos tienen stock bajo o insuficiente:
              </p>
              <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto shadow-inner">
                <ul className="space-y-2">
                  {stockBajo.map((producto) => (
                    <li
                      key={producto.id}
                      className="flex justify-between items-center text-sm border-b border-gray-200 pb-2"
                    >
                      <span className="font-semibold text-gray-900">
                        {producto.nombre}
                      </span>
                      <span className="text-red-800 font-bold bg-red-100 px-3 py-1 rounded-full text-xs">
                        Stock: {producto.stock_actual} / Mín:{" "}
                        {producto.stock_minimo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => navigate("/productos")}
                className="mt-4 bg-gradient-to-r from-red-200 to-amber-200 hover:from-red-300 hover:to-amber-300 text-red-800 px-6 py-2 rounded-xl transition-all shadow-md font-semibold"
              >
                Ir a Inventario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
