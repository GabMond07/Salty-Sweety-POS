import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Product, DashboardMetrics } from "../types";
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
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .filter("stock_actual", "lte", "stock_minimo");

      if (error) throw error;
      return data || [];
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
      color: "bg-green-500",
      loading: loadingVentasHoy,
    },
    {
      title: "Ventas del Mes",
      value: `$${(ventasMes || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: "bg-blue-500",
      loading: loadingVentasMes,
    },
    {
      title: "Stock Bajo",
      value: `${stockBajo?.length || 0} productos`,
      icon: AlertTriangle,
      color: "bg-red-500",
      loading: loadingStockBajo,
      alert: (stockBajo?.length || 0) > 0,
    },
    {
      title: "Clientes Activos",
      value: clientesActivos || 0,
      icon: Users,
      color: "bg-purple-500",
      loading: loadingClientes,
    },
  ];

  const quickActions = [
    {
      title: "Nueva Venta",
      icon: ShoppingCart,
      color: "bg-blue-600 hover:bg-blue-700",
      path: "/ventas",
    },
    {
      title: "Inventario",
      icon: Package,
      color: "bg-green-600 hover:bg-green-700",
      path: "/productos",
    },
    {
      title: "Clientes",
      icon: Users,
      color: "bg-purple-600 hover:bg-purple-700",
      path: "/clientes",
    },
    {
      title: "Cotizaciones",
      icon: FileText,
      color: "bg-orange-600 hover:bg-orange-700",
      path: "/cotizaciones",
    },
    {
      title: "Notas de Crédito",
      icon: FileText,
      color: "bg-pink-600 hover:bg-pink-700",
      path: "/notas",
    },
    {
      title: "Almacén",
      icon: Archive,
      color: "bg-indigo-600 hover:bg-indigo-700",
      path: "/almacen",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          ¡Bienvenido a Salty & Sweety POS!
        </h1>
        <p className="text-gray-600">
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
            className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
              metric.alert ? "border-red-500" : "border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {metric.title}
                </p>
                {metric.loading ? (
                  <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-800">
                    {metric.value}
                  </p>
                )}
              </div>
              <div className={`${metric.color} p-3 rounded-full`}>
                <metric.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => navigate(action.path)}
              className={`${action.color} text-white p-6 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 flex items-center space-x-4`}
            >
              <action.icon className="w-8 h-8" />
              <span className="text-lg font-semibold">{action.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stock Bajo Alert */}
      {stockBajo && stockBajo.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-md">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-500 mr-3 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 mb-2">
                ⚠️ Alerta de Inventario
              </h3>
              <p className="text-red-700 mb-3">
                Los siguientes productos tienen stock bajo o insuficiente:
              </p>
              <div className="bg-white rounded p-4 max-h-48 overflow-y-auto">
                <ul className="space-y-2">
                  {stockBajo.map((producto) => (
                    <li
                      key={producto.id}
                      className="flex justify-between items-center text-sm border-b pb-2"
                    >
                      <span className="font-medium text-gray-800">
                        {producto.nombre}
                      </span>
                      <span className="text-red-600 font-bold">
                        Stock: {producto.stock_actual} / Mínimo:{" "}
                        {producto.stock_minimo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => navigate("/productos")}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
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
