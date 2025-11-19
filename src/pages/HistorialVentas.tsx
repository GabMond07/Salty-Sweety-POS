import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Venta, VentaItem, Product, Cliente } from "../types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Eye,
  XCircle,
  Download,
  Filter,
  Search,
  CreditCard,
  Banknote,
  User,
  FileDown,
  X,
  Package,
} from "lucide-react";

type PeriodoFiltro = "hoy" | "semana" | "mes" | "año" | "personalizado";

interface VentaConDetalles extends Venta {
  cliente?: Cliente;
  items?: (VentaItem & { producto?: Product })[];
}

export default function HistorialVentas() {
  const queryClient = useQueryClient();
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState<string>("todos");
  const [clienteFiltro, setClienteFiltro] = useState<number | "todos">("todos");
  const [selectedVenta, setSelectedVenta] = useState<VentaConDetalles | null>(
    null
  );
  const [showDetalles, setShowDetalles] = useState(false);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);
  const [ventaToAnular, setVentaToAnular] = useState<Venta | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const pdfPreviewRef = useRef<HTMLDivElement>(null);

  const getFechaRange = () => {
    const now = new Date();
    let inicio = new Date();
    let fin = new Date();

    switch (periodoFiltro) {
      case "hoy":
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(23, 59, 59, 999);
        break;
      case "semana":
        inicio.setDate(now.getDate() - 7);
        break;
      case "mes":
        inicio.setMonth(now.getMonth() - 1);
        break;
      case "año":
        inicio.setFullYear(now.getFullYear() - 1);
        break;
      case "personalizado":
        if (fechaInicio && fechaFin) {
          return {
            inicio: new Date(fechaInicio).toISOString(),
            fin: new Date(fechaFin + "T23:59:59").toISOString(),
          };
        }
        break;
    }

    return {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
    };
  };

  const { data: ventas, isLoading: loadingVentas } = useQuery<Venta[]>({
    queryKey: [
      "ventas",
      periodoFiltro,
      fechaInicio,
      fechaFin,
      metodoPagoFiltro,
      clienteFiltro,
    ],
    queryFn: async () => {
      const { inicio, fin } = getFechaRange();
      let query = supabase
        .from("ventas")
        .select("*, clientes(nombre)")
        .gte("created_at", inicio)
        .lte("created_at", fin)
        .order("created_at", { ascending: false });

      if (metodoPagoFiltro !== "todos") {
        query = query.eq("metodo_pago", metodoPagoFiltro);
      }

      if (clienteFiltro !== "todos") {
        query = query.eq("cliente_id", clienteFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: detallesVenta } = useQuery<VentaItem[]>({
    queryKey: ["venta-items", selectedVenta?.id],
    queryFn: async () => {
      if (!selectedVenta) return [];
      const { data, error } = await supabase
        .from("venta_items")
        .select("*, productos(*)")
        .eq("venta_id", selectedVenta.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedVenta,
  });

  const anularVentaMutation = useMutation({
    mutationFn: async (ventaId: number) => {
      const { data: items, error: itemsError } = await supabase
        .from("venta_items")
        .select("producto_id, cantidad")
        .eq("venta_id", ventaId);

      if (itemsError) throw itemsError;

      for (const item of items || []) {
        const { data: producto } = await supabase
          .from("productos")
          .select("stock_actual")
          .eq("id", item.producto_id)
          .single();

        if (producto) {
          await supabase
            .from("productos")
            .update({
              stock_actual: producto.stock_actual + item.cantidad,
            })
            .eq("id", item.producto_id);

          await supabase.from("movimientos_inventario").insert({
            producto_id: item.producto_id,
            tipo_movimiento: "devolucion",
            cantidad: item.cantidad,
            justificacion: `Anulación de venta #${ventaId}`,
          });
        }
      }

      await supabase.from("venta_items").delete().eq("venta_id", ventaId);

      const { error } = await supabase
        .from("ventas")
        .delete()
        .eq("id", ventaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["ventasHoy"] });
      queryClient.invalidateQueries({ queryKey: ["ventasMes"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
      setShowAnularConfirm(false);
      setVentaToAnular(null);
    },
  });

  const totalVentas = ventas?.reduce((sum, v) => sum + v.total, 0) || 0;
  const cantidadVentas = ventas?.length || 0;
  const promedioVenta = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;
  const ventasEfectivo =
    ventas?.filter((v) => v.metodo_pago === "efectivo").length || 0;
  const ventasTarjeta =
    ventas?.filter((v) => v.metodo_pago === "tarjeta").length || 0;

  const openDetalles = async (venta: Venta) => {
    setSelectedVenta(venta);
    setShowDetalles(true);
  };

  const handleAnular = (venta: Venta) => {
    setVentaToAnular(venta);
    setShowAnularConfirm(true);
  };

  const exportarCSV = () => {
    if (!ventas || ventas.length === 0) return;

    const headers = ["ID", "Fecha", "Cliente", "Total", "Método de Pago"];
    const rows = ventas.map((v) => [
      v.id,
      new Date(v.created_at).toLocaleString("es-MX"),
      (v as any).clientes?.nombre || "Cliente general",
      v.total.toFixed(2),
      v.metodo_pago,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${periodoFiltro}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
  };

  const generarPDF = async () => {
    if (!ventas || ventas.length === 0 || !pdfPreviewRef.current) return;

    try {
      const canvas = await html2canvas(pdfPreviewRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: pdfPreviewRef.current.scrollWidth,
        height: pdfPreviewRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Calcular dimensiones para ajustar a una sola página
      const imgWidth = pdfWidth - 10; // Margen de 5mm a cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Si la imagen es muy alta, ajustarla al alto de la página
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;

      if (imgHeight > pdfHeight - 10) {
        finalHeight = pdfHeight - 10; // Margen de 5mm arriba y abajo
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      // Centrar la imagen en la página
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;

      pdf.addImage(
        imgData,
        "PNG",
        xOffset,
        yOffset,
        finalWidth,
        finalHeight,
        undefined,
        "FAST"
      );

      const fechaActual = new Date().toISOString().split("T")[0];
      pdf.save(`reporte_ventas_${periodoFiltro}_${fechaActual}.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Ocurrió un error al generar el PDF. Por favor intenta de nuevo.");
    }
  };

  const openPDFPreview = () => {
    setShowPDFPreview(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-6 lg:p-8 rounded-2xl shadow-sm border border-pink-50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                Historial de Ventas
              </h1>
              <p className="text-gray-600 font-medium">
                Revisa y gestiona ventas pasadas
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center space-x-4">
              <FileText className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-gray-600">
                {cantidadVentas} ventas en {periodoFiltro}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Ventas
                </p>
                <p className="text-3xl font-bold text-emerald-700">
                  ${totalVentas.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-emerald-400" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cantidad</p>
                <p className="text-3xl font-bold text-blue-700">
                  {cantidadVentas}
                </p>
              </div>
              <FileText className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio</p>
                <p className="text-3xl font-bold text-purple-700">
                  ${promedioVenta.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-400" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-pink-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Métodos</p>
                <p className="text-sm font-semibold text-gray-800">
                  E: {ventasEfectivo} | T: {ventasTarjeta}
                </p>
              </div>
              <CreditCard className="w-12 h-12 text-pink-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-purple-50 sticky top-4 z-10">
          <div className="flex items-center space-x-3 mb-6">
            <Filter className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-gray-800">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periodo
              </label>
              <select
                value={periodoFiltro}
                onChange={(e) =>
                  setPeriodoFiltro(e.target.value as PeriodoFiltro)
                }
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
                <option value="año">Año</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            {periodoFiltro === "personalizado" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inicio
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fin
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pago
              </label>
              <select
                value={metodoPagoFiltro}
                onChange={(e) => setMetodoPagoFiltro(e.target.value)}
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
              >
                <option value="todos">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente
              </label>
              <select
                value={clienteFiltro}
                onChange={(e) =>
                  setClienteFiltro(
                    e.target.value === "todos"
                      ? "todos"
                      : Number(e.target.value)
                  )
                }
                className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
              >
                <option value="todos">Todos</option>
                {clientes?.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={openPDFPreview}
              className="bg-gradient-to-r from-emerald-200 to-pink-200 hover:from-emerald-300 hover:to-pink-300 text-emerald-700 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium flex-1 sm:flex-none"
            >
              <FileDown className="w-5 h-5" />
              <span>Exportar PDF</span>
            </button>
            <button
              onClick={exportarCSV}
              className="bg-gradient-to-r from-blue-200 to-purple-200 hover:from-blue-300 hover:to-purple-300 text-blue-700 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium flex-1 sm:flex-none"
            >
              <Download className="w-5 h-5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-50">
          {loadingVentas ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Cargando...</p>
            </div>
          ) : ventas && ventas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-100">
                <thead className="bg-gradient-to-r from-pink-50 to-purple-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Pago
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ventas.map((venta, index) => (
                    <tr
                      key={venta.id}
                      className={`transition-all duration-200 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-25"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-800">
                          #{venta.id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {new Date(venta.created_at).toLocaleDateString(
                            "es-MX",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 font-medium">
                          {(venta as any).clientes?.nombre || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-emerald-700">
                          ${venta.total.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            venta.metodo_pago === "efectivo"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {venta.metodo_pago === "efectivo" ? (
                            <Banknote className="w-3 h-3 mr-1" />
                          ) : (
                            <CreditCard className="w-3 h-3 mr-1" />
                          )}
                          {venta.metodo_pago}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openDetalles(venta)}
                          className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-xl transition-all duration-200"
                          title="Detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAnular(venta)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all duration-200"
                          title="Anular"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-40 text-purple-300" />
              <p className="text-xl font-medium text-gray-600">Sin ventas</p>
              <p className="text-sm">Ajusta filtros para ver resultados</p>
            </div>
          )}
        </div>

        {showDetalles && selectedVenta && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">
                  Venta #{selectedVenta.id}
                </h2>
                <button
                  onClick={() => {
                    setShowDetalles(false);
                    setSelectedVenta(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(selectedVenta.created_at).toLocaleString(
                        "es-MX"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-semibold text-gray-800">
                      {(selectedVenta as any).clientes?.nombre || "General"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pago</p>
                    <p className="font-semibold capitalize text-gray-800">
                      {selectedVenta.metodo_pago}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="font-bold text-emerald-700 text-2xl">
                      ${selectedVenta.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <span>Productos</span>
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-pink-50 to-purple-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Producto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Cant.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Unitario
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detallesVenta?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-800">
                            {item.productos?.nombre || "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {item.cantidad}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            ${item.precio_unitario.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-emerald-700 text-right">
                            ${(item.cantidad * item.precio_unitario).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAnularConfirm && ventaToAnular && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-100 p-3 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  Anular Venta
                </h3>
              </div>

              <p className="text-gray-600 mb-6">
                ¿Anular #{ventaToAnular.id}? Se devuelve stock y borra el
                registro.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAnularConfirm(false);
                    setVentaToAnular(null);
                  }}
                  className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => anularVentaMutation.mutate(ventaToAnular.id)}
                  disabled={anularVentaMutation.isPending}
                  className="bg-gradient-to-r from-red-200 to-red-300 hover:from-red-300 hover:to-red-400 text-red-700 px-6 py-3 rounded-xl flex items-center space-x-2 disabled:opacity-50 transition-all shadow-sm font-medium"
                >
                  <XCircle className="w-5 h-5" />
                  <span>
                    {anularVentaMutation.isPending ? "Anulando..." : "Anular"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showPDFPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Vista Previa PDF
                </h2>
                <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
                  <button
                    onClick={generarPDF}
                    className="bg-gradient-to-r from-emerald-200 to-pink-200 hover:from-emerald-300 hover:to-pink-300 text-emerald-700 px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center space-x-2 transition-all font-medium shadow-sm text-sm sm:text-base flex-1 sm:flex-none"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Descargar</span>
                  </button>
                  <button
                    onClick={() => setShowPDFPreview(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              <div
                ref={pdfPreviewRef}
                className="p-3 sm:p-6 overflow-y-auto flex-grow"
                style={{
                  backgroundColor: "white",
                  fontFamily: "Arial, sans-serif",
                  maxWidth: "190mm",
                  margin: "0 auto",
                }}
              >
                <div className="w-full">
                  {/* Header compacto */}
                  <div className="text-center mb-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
                      Reporte de Ventas
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 font-medium">
                      Salty & Sweety POS
                    </p>
                    <p className="text-xs text-gray-500">
                      {periodoFiltro.charAt(0).toUpperCase() +
                        periodoFiltro.slice(1)}{" "}
                      |{" "}
                      {new Date().toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Métricas en grid compacto */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-2 rounded-lg border border-emerald-200">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">
                        Total
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-emerald-700">
                        ${totalVentas.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-2 rounded-lg border border-blue-200">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">
                        Ventas
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-blue-700">
                        {cantidadVentas}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-2 rounded-lg border border-purple-200">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">
                        Promedio
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-purple-700">
                        ${promedioVenta.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-2 rounded-lg border border-pink-200">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">
                        Efectivo/Tarjeta
                      </p>
                      <p className="text-[10px] sm:text-xs font-semibold text-gray-800">
                        {ventasEfectivo} / {ventasTarjeta}
                      </p>
                    </div>
                  </div>

                  {/* Tabla optimizada */}
                  <div className="border border-gray-300 rounded-lg overflow-hidden mb-3">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-gradient-to-r from-pink-100 to-purple-100">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 border-b border-gray-300">
                            ID
                          </th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 border-b border-gray-300">
                            Fecha/Hora
                          </th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 border-b border-gray-300">
                            Cliente
                          </th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 border-b border-gray-300">
                            Total
                          </th>
                          <th className="px-2 py-1.5 text-left text-[10px] font-bold text-gray-700 border-b border-gray-300">
                            Pago
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.slice(0, 15).map((venta, index) => (
                          <tr
                            key={venta.id}
                            className={
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="px-2 py-1 text-[10px] font-bold text-gray-800 border-b border-gray-200">
                              #{venta.id}
                            </td>
                            <td className="px-2 py-1 text-[9px] text-gray-700 border-b border-gray-200">
                              {new Date(venta.created_at).toLocaleDateString(
                                "es-MX",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                }
                              )}{" "}
                              {new Date(venta.created_at).toLocaleTimeString(
                                "es-MX",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </td>
                            <td className="px-2 py-1 text-[10px] text-gray-700 font-medium border-b border-gray-200">
                              {(venta as any).clientes?.nombre || "General"}
                            </td>
                            <td className="px-2 py-1 text-[10px] font-bold text-emerald-700 border-b border-gray-200">
                              ${venta.total.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border-b border-gray-200">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  venta.metodo_pago === "efectivo"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {venta.metodo_pago === "efectivo" ? "💵" : "💳"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gradient-to-r from-pink-50 to-purple-50">
                        <tr>
                          <td
                            colSpan={3}
                            className="px-2 py-1.5 text-[10px] font-bold text-gray-700 text-right border-t-2 border-gray-300"
                          >
                            TOTAL:
                          </td>
                          <td className="px-2 py-1.5 text-xs font-bold text-emerald-700 border-t-2 border-gray-300">
                            ${totalVentas.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] font-semibold text-gray-600 border-t-2 border-gray-300">
                            {cantidadVentas} ventas
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Resumen en dos columnas compacto */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-2 rounded-lg border border-emerald-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600 font-medium">
                          Total Efectivo:
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          $
                          {ventas
                            .filter((v) => v.metodo_pago === "efectivo")
                            .reduce((sum, v) => sum + v.total, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-2 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600 font-medium">
                          Total Tarjeta:
                        </span>
                        <span className="text-xs font-bold text-blue-700">
                          $
                          {ventas
                            .filter((v) => v.metodo_pago === "tarjeta")
                            .reduce((sum, v) => sum + v.total, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-lg border border-purple-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600 font-medium">
                          Venta Más Alta:
                        </span>
                        <span className="text-xs font-bold text-purple-700">
                          $
                          {ventas.length > 0
                            ? Math.max(...ventas.map((v) => v.total)).toFixed(2)
                            : "0.00"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-pink-50 to-pink-100 p-2 rounded-lg border border-pink-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600 font-medium">
                          Venta Más Baja:
                        </span>
                        <span className="text-xs font-bold text-pink-700">
                          $
                          {ventas.length > 0
                            ? Math.min(...ventas.map((v) => v.total)).toFixed(2)
                            : "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer compacto */}
                  <div className="text-center text-[9px] text-gray-500 pt-2 border-t border-gray-300">
                    <p className="font-medium">
                      📊 Reporte generado por Salty & Sweety POS
                    </p>
                    <p>
                      {new Date().toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      -{" "}
                      {new Date().toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Nota si hay más de 15 ventas */}
                  {ventas.length > 15 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[9px] text-amber-800 text-center font-medium">
                        ⚠️ Mostrando las primeras 15 de {ventas.length} ventas.
                        Exporta a CSV para ver todas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
