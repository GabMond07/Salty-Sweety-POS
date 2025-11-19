import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Cliente, Product } from "../types";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
  Package,
  Minus,
  ShoppingCart,
} from "lucide-react";

interface Cotizacion {
  id: number;
  created_at: string;
  cliente_id: number;
  total: number;
  valida_hasta: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  usuario_id?: string;
}

interface CotizacionItem {
  id: number;
  cotizacion_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
}

interface CotizacionConDetalles extends Cotizacion {
  clientes?: Cliente;
  items?: (CotizacionItem & { productos?: Product })[];
}

interface CartItem {
  producto: Product;
  cantidad: number;
  subtotal: number;
}

export default function Cotizaciones() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [showDetalles, setShowDetalles] = useState(false);
  const [selectedCotizacion, setSelectedCotizacion] =
    useState<CotizacionConDetalles | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProducto, setSearchProducto] = useState("");
  const [formData, setFormData] = useState({
    cliente_id: 0,
    valida_hasta: "",
  });

  const { data: cotizaciones, isLoading: loadingCotizaciones } = useQuery<
    CotizacionConDetalles[]
  >({
    queryKey: ["cotizaciones", estadoFiltro],
    queryFn: async () => {
      let query = supabase
        .from("cotizaciones")
        .select("*, clientes(*)")
        .order("created_at", { ascending: false });

      if (estadoFiltro !== "todos") {
        query = query.eq("estado", estadoFiltro);
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

  const { data: productos } = useQuery<Product[]>({
    queryKey: ["productos", searchProducto],
    queryFn: async () => {
      let query = supabase.from("productos").select("*");

      if (searchProducto) {
        query = query.or(
          `nombre.ilike.%${searchProducto}%,sku.ilike.%${searchProducto}%`
        );
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: detallesCotizacion } = useQuery<CotizacionItem[]>({
    queryKey: ["cotizacion-items", selectedCotizacion?.id],
    queryFn: async () => {
      if (!selectedCotizacion) return [];
      const { data, error } = await supabase
        .from("cotizacion_items")
        .select("*, productos(*)")
        .eq("cotizacion_id", selectedCotizacion.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCotizacion,
  });

  const createCotizacionMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0 || !formData.cliente_id || !formData.valida_hasta)
        throw new Error("Datos incompletos");

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      const { data: cotizacion, error: cotizacionError } = await supabase
        .from("cotizaciones")
        .insert({
          cliente_id: formData.cliente_id,
          total,
          valida_hasta: formData.valida_hasta,
          estado: "pendiente",
        })
        .select()
        .single();

      if (cotizacionError) throw cotizacionError;

      const items = cart.map((item) => ({
        cotizacion_id: cotizacion.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio_venta,
      }));

      const { error: itemsError } = await supabase
        .from("cotizacion_items")
        .insert(items);

      if (itemsError) throw itemsError;

      return cotizacion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      resetForm();
      setShowModal(false);
    },
  });

  const updateEstadoMutation = useMutation({
    mutationFn: async ({
      id,
      estado,
    }: {
      id: number;
      estado: "aceptada" | "rechazada";
    }) => {
      const { error } = await supabase
        .from("cotizaciones")
        .update({ estado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      setShowDetalles(false);
      setSelectedCotizacion(null);
    },
  });

  const deleteCotizacionMutation = useMutation({
    mutationFn: async (id: number) => {
      await supabase.from("cotizacion_items").delete().eq("cotizacion_id", id);
      const { error } = await supabase
        .from("cotizaciones")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
    },
  });

  const resetForm = () => {
    setFormData({
      cliente_id: 0,
      valida_hasta: "",
    });
    setCart([]);
    setSearchProducto("");
  };

  const addToCart = (producto: Product) => {
    const existingItem = cart.find((item) => item.producto.id === producto.id);

    if (existingItem) {
      updateQuantity(producto.id, existingItem.cantidad + 1);
    } else {
      setCart([
        ...cart,
        {
          producto,
          cantidad: 1,
          subtotal: producto.precio_venta,
        },
      ]);
    }
  };

  const updateQuantity = (productoId: number, newQuantity: number) => {
    setCart(
      cart.map((item) => {
        if (item.producto.id === productoId) {
          const cantidad = Math.max(1, newQuantity);
          return {
            ...item,
            cantidad,
            subtotal: cantidad * item.producto.precio_venta,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productoId: number) => {
    setCart(cart.filter((item) => item.producto.id !== productoId));
  };

  const openDetalles = (cotizacion: CotizacionConDetalles) => {
    setSelectedCotizacion(cotizacion);
    setShowDetalles(true);
  };

  const handleDelete = (id: number) => {
    if (
      confirm("¿Eliminar esta cotización? Esta acción no se puede deshacer.")
    ) {
      deleteCotizacionMutation.mutate(id);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const getEstadoBadge = (estado: string) => {
    const styles = {
      pendiente: "bg-amber-100 text-amber-700",
      aceptada: "bg-emerald-100 text-emerald-700",
      rechazada: "bg-red-100 text-red-700",
    };
    const icons = {
      pendiente: Clock,
      aceptada: CheckCircle,
      rechazada: XCircle,
    };
    const Icon = icons[estado as keyof typeof icons];

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          styles[estado as keyof typeof styles]
        }`}
      >
        <Icon className="w-3 h-3 mr-1" />
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-6 lg:p-8 rounded-2xl shadow-sm border border-pink-50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                Cotizaciones
              </h1>
              <p className="text-gray-600 font-medium">
                Gestiona presupuestos y propuestas
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 lg:mt-0 bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Cotización</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 mb-6 border border-purple-50">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aceptada">Aceptadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loadingCotizaciones ? (
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl h-48 animate-pulse"
              />
            ))
          ) : cotizaciones && cotizaciones.length > 0 ? (
            cotizaciones.map((cotizacion) => (
              <div
                key={cotizacion.id}
                className="bg-white rounded-2xl shadow-sm p-6 border border-purple-100 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                      Cotización #{cotizacion.id}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {cotizacion.clientes?.nombre || "Cliente no especificado"}
                    </p>
                  </div>
                  {getEstadoBadge(cotizacion.estado)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Fecha:</span>
                    <span className="font-medium text-gray-800">
                      {new Date(cotizacion.created_at).toLocaleDateString(
                        "es-MX"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Válida hasta:</span>
                    <span className="font-medium text-gray-800">
                      {new Date(cotizacion.valida_hasta).toLocaleDateString(
                        "es-MX"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-600 font-medium">Total:</span>
                    <span className="text-2xl font-bold text-emerald-700">
                      ${cotizacion.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => openDetalles(cotizacion)}
                    className="flex-1 bg-gradient-to-r from-blue-100 to-purple-100 hover:from-blue-200 hover:to-purple-200 text-blue-700 px-4 py-2 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver</span>
                  </button>
                  <button
                    onClick={() => handleDelete(cotizacion.id)}
                    className="bg-gradient-to-r from-red-100 to-red-200 hover:from-red-200 hover:to-red-300 text-red-700 px-4 py-2 rounded-xl transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">
                No hay cotizaciones
              </p>
              <p className="text-gray-400 text-sm">
                Crea tu primera cotización
              </p>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">
                  Nueva Cotización
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                      <div className="relative mb-4">
                        <Search className="absolute left-4 top-4 w-5 h-5 text-purple-400" />
                        <input
                          type="text"
                          placeholder="Buscar producto..."
                          value={searchProducto}
                          onChange={(e) => setSearchProducto(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                        {productos?.map((producto) => (
                          <button
                            key={producto.id}
                            onClick={() => addToCart(producto)}
                            className="bg-white hover:bg-gradient-to-br hover:from-pink-50 hover:to-purple-50 p-3 rounded-xl border border-pink-100 transition-colors duration-200 text-left"
                          >
                            <h4 className="font-semibold text-gray-800 text-sm mb-1 truncate">
                              {producto.nombre}
                            </h4>
                            <p className="text-lg font-bold text-purple-700">
                              ${producto.precio_venta.toFixed(2)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cliente *
                      </label>
                      <select
                        value={formData.cliente_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cliente_id: Number(e.target.value),
                          })
                        }
                        required
                        className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                      >
                        <option value={0}>Seleccionar cliente</option>
                        {clientes?.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Válida hasta *
                      </label>
                      <input
                        type="date"
                        value={formData.valida_hasta}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valida_hasta: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                      />
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                        <ShoppingCart className="w-5 h-5 text-purple-600" />
                        <span>Items ({cart.length})</span>
                      </h3>

                      {cart.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Agrega productos
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {cart.map((item) => (
                            <div
                              key={item.producto.id}
                              className="bg-white rounded-lg p-2 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {item.producto.nombre}
                                </p>
                                <p className="text-xs text-purple-600 font-semibold">
                                  ${item.subtotal.toFixed(2)}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.producto.id,
                                      item.cantidad - 1
                                    )
                                  }
                                  className="p-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-semibold w-6 text-center">
                                  {item.cantidad}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.producto.id,
                                      item.cantidad + 1
                                    )
                                  }
                                  className="p-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    removeFromCart(item.producto.id)
                                  }
                                  className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-800">
                            Total:
                          </span>
                          <span className="text-2xl font-bold text-emerald-700">
                            ${total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => createCotizacionMutation.mutate()}
                      disabled={
                        cart.length === 0 ||
                        !formData.cliente_id ||
                        !formData.valida_hasta ||
                        createCotizacionMutation.isPending
                      }
                      className="w-full bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 transition-all shadow-sm font-medium"
                    >
                      <Save className="w-5 h-5" />
                      <span>
                        {createCotizacionMutation.isPending
                          ? "Guardando..."
                          : "Crear Cotización"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetalles && selectedCotizacion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">
                  Cotización #{selectedCotizacion.id}
                </h2>
                <button
                  onClick={() => {
                    setShowDetalles(false);
                    setSelectedCotizacion(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-semibold text-gray-800">
                      {selectedCotizacion.clientes?.nombre || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(
                        selectedCotizacion.created_at
                      ).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Válida hasta</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(
                        selectedCotizacion.valida_hasta
                      ).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estado</p>
                    {getEstadoBadge(selectedCotizacion.estado)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      ${selectedCotizacion.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Productos
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
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
                          Precio
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detallesCotizacion?.map((item: any) => (
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

                {selectedCotizacion.estado === "pendiente" && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() =>
                        updateEstadoMutation.mutate({
                          id: selectedCotizacion.id,
                          estado: "aceptada",
                        })
                      }
                      className="flex-1 bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm font-medium"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Aceptar</span>
                    </button>
                    <button
                      onClick={() =>
                        updateEstadoMutation.mutate({
                          id: selectedCotizacion.id,
                          estado: "rechazada",
                        })
                      }
                      className="flex-1 bg-gradient-to-r from-red-200 to-red-300 hover:from-red-300 hover:to-red-400 text-red-700 px-6 py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm font-medium"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
