import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Product, Cliente, CartItem, VentaItem } from "../types";
import {
  Search,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  User,
  CreditCard,
  Banknote,
  CheckCircle,
  Package,
} from "lucide-react";

export default function Ventas() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "tarjeta">(
    "efectivo"
  );
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: productos, isLoading: loadingProductos } = useQuery<Product[]>({
    queryKey: ["productos", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("productos")
        .select("*")
        .gt("stock_actual", 0)
        .order("nombre");

      if (searchTerm) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000, // Actualizar cada 5 segundos
    staleTime: 2000, // Considerar datos obsoletos después de 2 segundos
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

  const createVentaMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("El carrito está vacío");

      // Validar stock disponible antes de procesar la venta
      for (const item of cart) {
        const { data: productoActual, error } = await supabase
          .from("productos")
          .select("stock_actual")
          .eq("id", item.producto.id)
          .single();

        if (error) throw new Error("Error al verificar stock");

        if (!productoActual || productoActual.stock_actual < item.cantidad) {
          throw new Error(
            `Stock insuficiente para ${
              item.producto.nombre
            }. Stock disponible: ${productoActual?.stock_actual || 0}`
          );
        }
      }

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      const { data: venta, error: ventaError } = await supabase
        .from("ventas")
        .insert({
          total,
          metodo_pago: metodoPago,
          cliente_id: selectedClient?.id,
        })
        .select()
        .single();

      if (ventaError) throw ventaError;

      const ventaItems: Omit<VentaItem, "id">[] = cart.map((item) => ({
        venta_id: venta.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio_venta,
      }));

      const { error: itemsError } = await supabase
        .from("venta_items")
        .insert(ventaItems);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("productos")
          .update({
            stock_actual: item.producto.stock_actual - item.cantidad,
          })
          .eq("id", item.producto.id);

        if (stockError) throw stockError;

        await supabase.from("movimientos_inventario").insert({
          producto_id: item.producto.id,
          tipo_movimiento: "venta",
          cantidad: -item.cantidad,
          justificacion: `Venta #${venta.id}`,
        });
      }

      return venta;
    },
    onSuccess: () => {
      setCart([]);
      setSelectedClient(null);
      setMetodoPago("efectivo");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["ventasHoy"] });
      queryClient.invalidateQueries({ queryKey: ["ventasMes"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
    },
  });

  const addToCart = (producto: Product) => {
    // Verificar que el producto tenga stock disponible
    if (producto.stock_actual <= 0) {
      return;
    }

    const existingItem = cart.find((item) => item.producto.id === producto.id);

    if (existingItem) {
      if (existingItem.cantidad < producto.stock_actual) {
        updateQuantity(producto.id, existingItem.cantidad + 1);
      }
    } else {
      setCart([
        ...cart,
        { producto, cantidad: 1, subtotal: producto.precio_venta },
      ]);
    }
  };

  const updateQuantity = (productoId: number, newQuantity: number) => {
    setCart(
      cart.map((item) => {
        if (item.producto.id === productoId) {
          const cantidad = Math.max(
            1,
            Math.min(newQuantity, item.producto.stock_actual)
          );
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

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-gradient-to-r from-emerald-100 via-emerald-200 to-pink-100 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl shadow-lg flex items-center space-x-3 z-50 animate-pulse">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">¡Venta completada con éxito!</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-6 lg:p-8 rounded-2xl shadow-sm border border-pink-50">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Punto de Venta
          </h1>
          <p className="text-gray-600 font-medium">
            Gestiona ventas en tiempo real
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-purple-50">
              <div className="relative mb-4">
                <Search className="absolute left-4 top-4 w-5 h-5 text-purple-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none transition-all"
                  autoFocus
                />
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
                <Package className="w-5 h-5 text-emerald-600" />
                <span>Productos Disponibles</span>
              </h2>

              {loadingProductos ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-32 bg-gradient-to-br from-purple-50 to-pink-50 animate-pulse rounded-xl"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-2">
                  {productos &&
                    Array.isArray(productos) &&
                    productos.map((producto: Product) => {
                      const stockBajo =
                        producto.stock_actual <= (producto.stock_minimo || 5);
                      const sinStock = producto.stock_actual === 0;

                      // No mostrar productos sin stock
                      if (sinStock) return null;

                      return (
                        <button
                          key={producto.id}
                          onClick={() => addToCart(producto)}
                          disabled={sinStock}
                          className={`group bg-gradient-to-br p-4 rounded-xl border transition-colors duration-200 shadow-sm hover:shadow-md text-left ${
                            sinStock
                              ? "from-gray-100 to-gray-200 border-gray-300 opacity-50 cursor-not-allowed"
                              : stockBajo
                              ? "from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 border-orange-200"
                              : "from-pink-50 to-purple-50 hover:from-pink-100 hover:to-purple-100 border-pink-100"
                          }`}
                        >
                          {producto.imagen_url && (
                            <img
                              src={producto.imagen_url}
                              alt={producto.nombre}
                              className="w-full h-20 object-cover rounded-lg mb-3 group-hover:opacity-90 transition-opacity"
                            />
                          )}
                          <h3 className="font-semibold text-gray-800 mb-2 truncate text-sm">
                            {producto.nombre}
                          </h3>
                          <p className="text-xl font-bold text-purple-700 mb-2">
                            ${producto.precio_venta.toFixed(2)}
                          </p>
                          <div className="space-y-1">
                            <p
                              className={`text-xs font-medium ${
                                stockBajo
                                  ? "text-orange-700 bg-orange-100 px-2 py-1 rounded"
                                  : "text-emerald-700"
                              }`}
                            >
                              Stock: {producto.stock_actual}
                              {stockBajo && " ⚠️"}
                            </p>
                            {producto.sku && (
                              <p className="text-xs text-gray-500">
                                SKU: {producto.sku}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-purple-50">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-purple-100 p-2 rounded-xl">
                  <User className="w-5 h-5 text-purple-700" />
                </div>
                <h3 className="font-semibold text-gray-800">
                  Seleccionar Cliente
                </h3>
              </div>
              <select
                value={selectedClient?.id || ""}
                onChange={(e) => {
                  const cliente = clientes?.find(
                    (c) => c.id === Number(e.target.value)
                  );
                  setSelectedClient(cliente || null);
                }}
                className="w-full px-3 py-2 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              >
                <option value="">Cliente general</option>
                {clientes?.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}{" "}
                    {cliente.telefono ? `(${cliente.telefono})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-pink-50 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-pink-100 p-2 rounded-xl">
                    <ShoppingCart className="w-5 h-5 text-pink-700" />
                  </div>
                  <h3 className="font-semibold text-gray-800">
                    Carrito ({cart.length})
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-red-600 hover:text-red-700 text-sm font-medium bg-red-50 px-3 py-1 rounded-lg transition-all duration-200 hover:bg-red-100"
                  >
                    <X className="w-4 h-4 inline mr-1" /> Limpiar
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="bg-gray-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-10 h-10 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">
                    Añade productos para empezar
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {cart.map((item) => (
                    <div
                      key={item.producto.id}
                      className="border border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 transition-all duration-200 hover:shadow-inner"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-800 text-sm flex-1 pr-2 truncate">
                          {item.producto.nombre}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.producto.id)}
                          className="text-red-600 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-all duration-200 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              updateQuantity(
                                item.producto.id,
                                item.cantidad - 1
                              )
                            }
                            className="bg-purple-200 hover:bg-purple-300 text-purple-700 p-1.5 rounded-lg transition-all duration-200"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-semibold w-10 text-center text-gray-800 bg-white px-2 py-1 rounded">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(
                                item.producto.id,
                                item.cantidad + 1
                              )
                            }
                            disabled={
                              item.cantidad >= item.producto.stock_actual
                            }
                            className="bg-purple-200 hover:bg-purple-300 text-purple-700 p-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="font-bold text-purple-700 text-sm">
                          ${item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 mt-4">
                <div className="flex justify-between items-center mb-4 p-2 bg-gradient-to-r from-emerald-50 to-pink-50 rounded-xl">
                  <span className="text-xl font-bold text-gray-800">
                    Total:
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 animate-pulse">
                    ${total.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => createVentaMutation.mutate()}
                  disabled={cart.length === 0 || createVentaMutation.isPending}
                  className="w-full bg-gradient-to-r from-emerald-200 via-emerald-300 to-pink-200 hover:from-emerald-300 hover:to-pink-300 text-emerald-800 py-3 lg:py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
                >
                  {createVentaMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-800"></div>
                      <span>Procesando pago...</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      <span>Completar Venta</span>
                    </>
                  )}
                </button>

                {createVentaMutation.isError && (
                  <p className="mt-3 text-sm text-red-700 text-center bg-red-50 py-2 px-3 rounded-lg border border-red-100">
                    {createVentaMutation.error instanceof Error
                      ? createVentaMutation.error.message
                      : "Error al procesar. Revisa el carrito e intenta de nuevo."}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-blue-50">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <div className="bg-blue-100 p-2 rounded-xl">
                  <CreditCard className="w-5 h-5 text-blue-700" />
                </div>
                <span>Método de Pago</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMetodoPago("efectivo")}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                    metodoPago === "efectivo"
                      ? "border-emerald-200 bg-emerald-50 shadow-sm scale-105"
                      : "border-gray-200 hover:border-gray-300 hover:scale-102"
                  }`}
                >
                  <Banknote
                    className={`w-6 h-6 mx-auto mb-2 transition-colors ${
                      metodoPago === "efectivo"
                        ? "text-emerald-700"
                        : "text-gray-500"
                    }`}
                  />
                  <p
                    className={`text-sm font-medium text-center transition-colors ${
                      metodoPago === "efectivo"
                        ? "text-emerald-700"
                        : "text-gray-600"
                    }`}
                  >
                    Efectivo
                  </p>
                </button>
                <button
                  onClick={() => setMetodoPago("tarjeta")}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                    metodoPago === "tarjeta"
                      ? "border-blue-200 bg-blue-50 shadow-sm scale-105"
                      : "border-gray-200 hover:border-gray-300 hover:scale-102"
                  }`}
                >
                  <CreditCard
                    className={`w-6 h-6 mx-auto mb-2 transition-colors ${
                      metodoPago === "tarjeta"
                        ? "text-blue-700"
                        : "text-gray-500"
                    }`}
                  />
                  <p
                    className={`text-sm font-medium text-center transition-colors ${
                      metodoPago === "tarjeta"
                        ? "text-blue-700"
                        : "text-gray-600"
                    }`}
                  >
                    Tarjeta
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
