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
  FileText,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();

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

  // Query para ventas de ayer (para calcular cambio)
  const { data: ventasAyer } = useQuery({
    queryKey: ["ventasAyer"],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ventas")
        .select("total")
        .gte("created_at", yesterdayStr)
        .lt("created_at", new Date().toISOString().split("T")[0]);

      if (error) throw error;
      return data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;
    },
  });

  const { data: ventasMes, isLoading: loadingVentasMes } = useQuery({
    queryKey: ["ventasMes"],
    queryFn: async () => {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      const { data, error } = await supabase
        .from("ventas")
        .select("total, created_at")
        .gte("created_at", firstDayOfMonth.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      const dias = {};
      data?.forEach((v) => {
        const dia = new Date(v.created_at).getDate();
        dias[dia] = (dias[dia] || 0) + (v.total || 0);
      });

      return Object.entries(dias).map(([dia, total]) => ({
        dia: parseInt(dia),
        total,
      }));
    },
  });

  // Query para ventas de las últimas 4 semanas
  const { data: ventasSemanas, isLoading: loadingVentasSemanas } = useQuery({
    queryKey: ["ventasSemanas"],
    queryFn: async () => {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const { data, error } = await supabase
        .from("ventas")
        .select("total, created_at")
        .gte("created_at", fourWeeksAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Agrupar por semana
      const semanas = {};
      data?.forEach((v) => {
        const fecha = new Date(v.created_at);
        const diff = Math.floor(
          (new Date().getTime() - fecha.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        const semanaKey = 4 - diff;
        if (semanaKey >= 1 && semanaKey <= 4) {
          semanas[semanaKey] = (semanas[semanaKey] || 0) + (v.total || 0);
        }
      });

      return [1, 2, 3, 4].map((sem) => ({
        semana: `Sem ${sem}`,
        total: semanas[sem] || 0,
      }));
    },
  });

  // Query para ventas de los últimos 6 meses
  const { data: ventasMeses, isLoading: loadingVentasMeses } = useQuery({
    queryKey: ["ventasMeses"],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from("ventas")
        .select("total, created_at")
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Agrupar por mes
      const meses = {};
      const mesesNombres = [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ];

      data?.forEach((v) => {
        const fecha = new Date(v.created_at);
        const mesKey = `${mesesNombres[fecha.getMonth()]}`;
        meses[mesKey] = (meses[mesKey] || 0) + (v.total || 0);
      });

      const result = [];
      for (let i = 5; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        const mesNombre = mesesNombres[fecha.getMonth()];
        result.push({
          mes: mesNombre,
          total: meses[mesNombre] || 0,
        });
      }

      return result;
    },
  });

  // Query para ventas del mes anterior (para calcular cambio)
  const { data: ventasMesAnterior } = useQuery({
    queryKey: ["ventasMesAnterior"],
    queryFn: async () => {
      const firstDayOfLastMonth = new Date();
      firstDayOfLastMonth.setMonth(firstDayOfLastMonth.getMonth() - 1);
      firstDayOfLastMonth.setDate(1);

      const lastDayOfLastMonth = new Date();
      lastDayOfLastMonth.setDate(0);

      const { data, error } = await supabase
        .from("ventas")
        .select("total")
        .gte("created_at", firstDayOfLastMonth.toISOString())
        .lte("created_at", lastDayOfLastMonth.toISOString());

      if (error) throw error;
      return data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;
    },
  });

  const { data: stockBajo, isLoading: loadingStockBajo } = useQuery<Product[]>({
    queryKey: ["stockBajo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos").select("*");

      if (error) throw error;

      return (data || []).filter(
        (producto) => producto.stock_actual <= producto.stock_minimo
      );
    },
  });

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

  // Funciones para calcular cambios
  const calcularCambio = (actual: number, anterior: number) => {
    if (anterior === 0) return actual > 0 ? "+100%" : "0%";
    const porcentaje = ((actual - anterior) / anterior) * 100;
    const signo = porcentaje >= 0 ? "+" : "";
    return `${signo}${porcentaje.toFixed(1)}%`;
  };

  const totalVentasMes = ventasMes?.reduce((sum, d) => sum + d.total, 0) || 0;
  const cambioVentasHoy = calcularCambio(ventasHoy || 0, ventasAyer || 0);
  const cambioVentasMes = calcularCambio(
    totalVentasMes,
    ventasMesAnterior || 0
  );

  const metrics = [
    {
      title: "Ventas Hoy",
      value: `$${(ventasHoy || 0).toFixed(2)}`,
      icon: DollarSign,
      color: "bg-emerald-100",
      textColor: "text-emerald-700",
      loading: loadingVentasHoy,
      change: cambioVentasHoy,
      changePositive: (ventasHoy || 0) >= (ventasAyer || 0),
    },
    {
      title: "Ventas del Mes",
      value: `$${totalVentasMes.toFixed(2)}`,
      icon: TrendingUp,
      color: "bg-blue-100",
      textColor: "text-blue-700",
      loading: loadingVentasMes,
      change: cambioVentasMes,
      changePositive: totalVentasMes >= (ventasMesAnterior || 0),
    },
    {
      title: "Stock Bajo",
      value: `${stockBajo?.length || 0} productos`,
      icon: AlertTriangle,
      color: "bg-red-100",
      textColor: "text-red-700",
      loading: loadingStockBajo,
      alert: (stockBajo?.length || 0) > 0,
      change: (stockBajo?.length || 0) > 0 ? "⚠️ Requiere atención" : "✓ OK",
      changePositive: (stockBajo?.length || 0) === 0,
    },
    {
      title: "Clientes Activos",
      value: clientesActivos || 0,
      icon: Users,
      color: "bg-purple-100",
      textColor: "text-purple-700",
      loading: loadingClientes,
      change: `Total registrados`,
      changePositive: true,
    },
  ];

  const quickActions = [
    {
      title: "Nueva Venta",
      icon: ShoppingCart,
      color:
        "bg-gradient-to-br from-pink-100 to-pink-200 hover:from-pink-200 hover:to-pink-300 text-pink-700",
      path: "/ventas",
    },
    {
      title: "Inventario",
      icon: Package,
      color:
        "bg-gradient-to-br from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300 text-emerald-700",
      path: "/productos",
    },
    {
      title: "Clientes",
      icon: Users,
      color:
        "bg-gradient-to-br from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300 text-purple-700",
      path: "/clientes",
    },
    {
      title: "Cotizaciones",
      icon: FileText,
      color:
        "bg-gradient-to-br from-amber-100 to-amber-200 hover:from-amber-200 hover:to-amber-300 text-amber-700",
      path: "/cotizaciones",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-6 lg:p-8 rounded-2xl shadow-sm border border-pink-50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                ¡Bienvenido a Salty & Sweety!
              </h1>
              <p className="text-gray-600 font-medium">
                Panel de control -{" "}
                {new Date().toLocaleDateString("es-MX", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center space-x-4">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span className="text-sm text-gray-600">Resumen General</span>
            </div>
          </div>
        </div>

        {/* Accesos Rápidos - Movidos arriba */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <span>⚡</span>
            <span>Accesos Rápidos</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className={`${action.color} shadow-sm p-4 rounded-xl transition-all duration-300 hover:scale-105 flex flex-col items-center space-y-2 text-center`}
              >
                <action.icon className="w-7 h-7" />
                <span className="text-sm font-semibold">{action.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className={`bg-white rounded-xl shadow-sm p-5 border-l-4 hover:shadow-md transition-all duration-300 ${
                metric.alert ? "border-red-200" : "border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    {metric.title}
                  </p>
                  {metric.loading ? (
                    <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg"></div>
                  ) : (
                    <p className={`text-2xl font-bold ${metric.textColor}`}>
                      {metric.value}
                    </p>
                  )}
                  {!metric.loading && (
                    <p
                      className={`text-xs font-medium mt-1 ${
                        metric.changePositive
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {metric.change}
                    </p>
                  )}
                </div>
                <div
                  className={`${metric.color} p-3 rounded-xl shadow-sm flex-shrink-0`}
                >
                  <metric.icon className={`w-5 h-5 ${metric.textColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gráficas de Ventas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Ventas por Día */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center space-x-2">
              <div className="w-3 h-3 bg-pink-400 rounded-full"></div>
              <span>Ventas por Día</span>
            </h3>
            {loadingVentasMes ? (
              <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={ventasMes}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="dia"
                    stroke="#9ca3af"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toFixed(2)}`,
                      "Total",
                    ]}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#fbb6ce"
                    strokeWidth={2}
                    dot={{ fill: "#fbb6ce", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Ventas por Semana */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              <span>Ventas por Semana</span>
            </h3>
            {loadingVentasSemanas ? (
              <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={ventasSemanas}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="semana"
                    stroke="#9ca3af"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toFixed(2)}`,
                      "Total",
                    ]}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Bar dataKey="total" fill="#ddd6fe" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Ventas por Mes */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span>Ventas por Mes</span>
            </h3>
            {loadingVentasMeses ? (
              <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={ventasMeses}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="mes"
                    stroke="#9ca3af"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <Tooltip
                    formatter={(value) => [`$${value.toFixed(2)}`, "Total"]}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Bar dataKey="total" fill="#bfdbfe" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {stockBajo && stockBajo.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-red-50">
            <div className="flex items-start space-x-4">
              <div className="bg-red-100 p-3 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-700 mb-2">
                  Alerta de Inventario
                </h3>
                <p className="text-red-600 mb-4 text-sm">
                  Productos con stock bajo:
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {stockBajo.slice(0, 5).map((producto) => (
                    <div
                      key={producto.id}
                      className="flex justify-between items-center text-sm border-b border-gray-100 pb-2"
                    >
                      <span className="font-medium text-gray-800 truncate">
                        {producto.nombre}
                      </span>
                      <span className="text-red-700 font-semibold bg-red-50 px-2 py-1 rounded text-xs">
                        {producto.stock_actual}/{producto.stock_minimo}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/productos")}
                  className="mt-4 bg-gradient-to-r from-red-100 to-amber-100 hover:from-red-200 hover:to-amber-200 text-red-700 px-4 py-2 rounded-xl transition-all font-medium text-sm"
                >
                  Ver Todos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
