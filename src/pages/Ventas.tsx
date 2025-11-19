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

  // Query para buscar productos
  const { data: productos, isLoading: loadingProductos } = useQuery<Product[]>({
    queryKey: ["productos", searchTerm],
    queryFn: async () => {
      let query = supabase.from("productos").select("*").gt("stock_actual", 0);

      if (searchTerm) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Query para buscar clientes
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

  // Mutation para crear venta
  const createVentaMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("El carrito está vacío");

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      // 1. Crear la venta
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

      // 2. Insertar items de la venta
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

      // 3. Actualizar stock de productos y crear movimientos de inventario
      for (const item of cart) {
        // Actualizar stock
        const { error: stockError } = await supabase
          .from("productos")
          .update({
            stock_actual: item.producto.stock_actual - item.cantidad,
          })
          .eq("id", item.producto.id);

        if (stockError) throw stockError;

        // Registrar movimiento de inventario
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
      // Limpiar carrito y estado
      setCart([]);
      setSelectedClient(null);
      setMetodoPago("efectivo");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Invalidar queries para actualizar dashboard
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["ventasHoy"] });
      queryClient.invalidateQueries({ queryKey: ["ventasMes"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
    },
  });

  // Funciones del carrito
  const addToCart = (producto: Product) => {
    const existingItem = cart.find((item) => item.producto.id === producto.id);

    if (existingItem) {
      if (existingItem.cantidad < producto.stock_actual) {
        updateQuantity(producto.id, existingItem.cantidad + 1);
      }
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-2 z-50 animate-bounce">
          <CheckCircle className="w-6 h-6" />
          <span className="font-semibold">¡Venta completada exitosamente!</span>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Punto de Venta
        </h1>
        <p className="text-gray-600">Gestiona tus ventas en tiempo real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sección de Productos - 2 columnas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Buscador */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Grid de productos */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Productos Disponibles
            </h2>
            {loadingProductos ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 bg-gray-200 animate-pulse rounded-lg"
                  ></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                {productos?.map((producto) => (
                  <button
                    key={producto.id}
                    onClick={() => addToCart(producto)}
                    className="bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 p-4 rounded-lg border border-blue-200 transition-all transform hover:scale-105 text-left"
                  >
                    <h3 className="font-semibold text-gray-800 mb-1 truncate">
                      {producto.nombre}
                    </h3>
                    <p className="text-2xl font-bold text-blue-600 mb-1">
                      ${producto.precio_venta.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Stock: {producto.stock_actual}
                    </p>
                    {producto.sku && (
                      <p className="text-xs text-gray-500 mt-1">
                        SKU: {producto.sku}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Carrito y Pago - 1 columna */}
        <div className="space-y-6">
          {/* Selección de Cliente */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center space-x-2 mb-3">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-800">Cliente</h3>
            </div>
            <select
              value={selectedClient?.id || ""}
              onChange={(e) => {
                const cliente = clientes?.find(
                  (c) => c.id === Number(e.target.value)
                );
                setSelectedClient(cliente || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Cliente general</option>
              {clientes?.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Carrito */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-800">
                  Carrito ({cart.length})
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Limpiar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>El carrito está vacío</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.producto.id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-800 text-sm flex-1">
                        {item.producto.nombre}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.producto.id)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.producto.id, item.cantidad - 1)
                          }
                          className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold w-8 text-center">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.producto.id, item.cantidad + 1)
                          }
                          disabled={item.cantidad >= item.producto.stock_actual}
                          className="bg-gray-200 hover:bg-gray-300 p-1 rounded disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="font-bold text-blue-600">
                        ${item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Método de Pago y Total */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Método de Pago</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setMetodoPago("efectivo")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  metodoPago === "efectivo"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <Banknote className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Efectivo</p>
              </button>
              <button
                onClick={() => setMetodoPago("tarjeta")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  metodoPago === "tarjeta"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <CreditCard className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Tarjeta</p>
              </button>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-2xl font-bold text-gray-800">Total:</span>
                <span className="text-3xl font-bold text-green-600">
                  ${total.toFixed(2)}
                </span>
              </div>

              <button
                onClick={() => createVentaMutation.mutate()}
                disabled={cart.length === 0 || createVentaMutation.isPending}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
              >
                {createVentaMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-6 h-6" />
                    <span>Completar Venta</span>
                  </>
                )}
              </button>

              {createVentaMutation.isError && (
                <p className="mt-2 text-sm text-red-600 text-center">
                  Error al procesar la venta. Intenta nuevamente.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
