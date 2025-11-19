import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Cliente, Product, Ingrediente } from "../types";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  X,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Package,
  Minus,
  ShoppingCart,
  Egg,
  Edit,
} from "lucide-react";

interface Cotizacion {
  id: number;
  created_at: string;
  cliente_id?: number; // Opcional: solo para personalizadas
  tipo: "personalizada" | "estandar";
  nombre_producto?: string; // Para cotizaciones estándar
  total: number;
  valida_hasta?: string; // Opcional: solo para personalizadas
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

interface CotizacionIngrediente {
  id: number;
  cotizacion_id: number;
  ingrediente_id: number;
  cantidad: number;
  precio_unitario: number;
  notas?: string;
}

interface CotizacionConDetalles extends Cotizacion {
  clientes?: Cliente;
  items?: (CotizacionItem & { productos?: Product })[];
  ingredientes?: (CotizacionIngrediente & { ingredientes?: Ingrediente })[];
}

interface CartItem {
  producto: Product;
  cantidad: number;
  subtotal: number;
}

interface CartIngrediente {
  ingrediente: Ingrediente;
  cantidad: number;
  subtotal: number;
  notas: string;
}

export default function Cotizaciones() {
  const queryClient = useQueryClient();
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [tipoCotizacion, setTipoCotizacion] = useState<
    "personalizada" | "estandar"
  >("personalizada");
  const [searchCotizacion, setSearchCotizacion] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetalles, setShowDetalles] = useState(false);
  const [showIngredientesManager, setShowIngredientesManager] = useState(false);
  const [showIngredienteModal, setShowIngredienteModal] = useState(false);
  const [editingIngrediente, setEditingIngrediente] =
    useState<Ingrediente | null>(null);
  const [selectedCotizacion, setSelectedCotizacion] =
    useState<CotizacionConDetalles | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartIngredientes, setCartIngredientes] = useState<CartIngrediente[]>(
    []
  );
  const [searchProducto, setSearchProducto] = useState("");
  const [searchIngrediente, setSearchIngrediente] = useState("");
  const [showIngredientes, setShowIngredientes] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: 0,
    valida_hasta: "",
    nombre_producto: "",
  });
  const [ingredienteFormData, setIngredienteFormData] = useState({
    nombre: "",
    unidad_medida: "kg",
    precio_unitario: 0,
    stock_actual: 0,
  });

  const { data: cotizaciones, isLoading: loadingCotizaciones } = useQuery<
    CotizacionConDetalles[]
  >({
    queryKey: ["cotizaciones", estadoFiltro, searchCotizacion],
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

      let filtered = data || [];

      // Filter by search term
      if (searchCotizacion) {
        const searchLower = searchCotizacion.toLowerCase();
        filtered = filtered.filter((cot) => {
          if (cot.tipo === "personalizada") {
            return (
              cot.id.toString().includes(searchLower) ||
              cot.clientes?.nombre?.toLowerCase().includes(searchLower) ||
              cot.clientes?.email?.toLowerCase().includes(searchLower)
            );
          } else {
            return (
              cot.id.toString().includes(searchLower) ||
              cot.nombre_producto?.toLowerCase().includes(searchLower)
            );
          }
        });
      }

      return filtered;
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

  const { data: ingredientes } = useQuery<Ingrediente[]>({
    queryKey: ["ingredientes", searchIngrediente],
    queryFn: async () => {
      let query = supabase.from("ingredientes").select("*").eq("activo", true);

      if (searchIngrediente) {
        query = query.ilike("nombre", `%${searchIngrediente}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allIngredientes } = useQuery<Ingrediente[]>({
    queryKey: ["all-ingredientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredientes")
        .select("*")
        .order("nombre");
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

  const { data: detallesIngredientes } = useQuery<CotizacionIngrediente[]>({
    queryKey: ["cotizacion-ingredientes", selectedCotizacion?.id],
    queryFn: async () => {
      if (!selectedCotizacion) return [];
      const { data, error } = await supabase
        .from("cotizacion_ingredientes")
        .select("*, ingredientes(*)")
        .eq("cotizacion_id", selectedCotizacion.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCotizacion,
  });

  const createCotizacionMutation = useMutation({
    mutationFn: async () => {
      // Validación según tipo de cotización
      if (tipoCotizacion === "personalizada") {
        if (
          (cart.length === 0 && cartIngredientes.length === 0) ||
          !formData.cliente_id ||
          !formData.valida_hasta
        )
          throw new Error(
            "Datos incompletos: Se requiere cliente y productos/ingredientes"
          );
      } else {
        // Estándar: solo ingredientes y nombre de producto (sin fecha)
        if (cartIngredientes.length === 0 || !formData.nombre_producto)
          throw new Error(
            "Datos incompletos: Se requiere nombre del producto e ingredientes"
          );
      }

      const totalProductos = cart.reduce((sum, item) => sum + item.subtotal, 0);
      const totalIngredientes = cartIngredientes.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const total = totalProductos + totalIngredientes;

      const cotizacionData: any = {
        tipo: tipoCotizacion,
        total,
        estado: "pendiente",
      };

      // Solo agregar valida_hasta si es personalizada
      if (tipoCotizacion === "personalizada") {
        cotizacionData.valida_hasta = formData.valida_hasta;
      }

      // Solo agregar cliente_id si es personalizada
      if (tipoCotizacion === "personalizada") {
        cotizacionData.cliente_id = formData.cliente_id;
      } else {
        cotizacionData.cliente_id = null; // Estándar no requiere cliente
        cotizacionData.nombre_producto = formData.nombre_producto; // Agregar nombre del producto
      }

      const { data: cotizacion, error: cotizacionError } = await supabase
        .from("cotizaciones")
        .insert(cotizacionData)
        .select()
        .single();

      if (cotizacionError) throw cotizacionError;

      // Insertar productos (solo para personalizadas)
      if (cart.length > 0 && tipoCotizacion === "personalizada") {
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
      }

      // Insertar ingredientes
      if (cartIngredientes.length > 0) {
        const ingredientesItems = cartIngredientes.map((item) => ({
          cotizacion_id: cotizacion.id,
          ingrediente_id: item.ingrediente.id,
          cantidad: item.cantidad,
          precio_unitario: item.ingrediente.precio_unitario,
          notas: item.notas,
        }));

        const { error: ingredientesError } = await supabase
          .from("cotizacion_ingredientes")
          .insert(ingredientesItems);

        if (ingredientesError) throw ingredientesError;
      }

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
      await supabase
        .from("cotizacion_ingredientes")
        .delete()
        .eq("cotizacion_id", id);
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

  // Mutations for Ingredientes CRUD
  const createIngredienteMutation = useMutation({
    mutationFn: async (ingrediente: {
      nombre: string;
      unidad_medida: string;
      precio_unitario: number;
      stock_actual: number;
    }) => {
      const { error } = await supabase
        .from("ingredientes")
        .insert([ingrediente]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-ingredientes"] });
      queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      setShowIngredienteModal(false);
      setIngredienteFormData({
        nombre: "",
        unidad_medida: "kg",
        precio_unitario: 0,
        stock_actual: 0,
      });
    },
  });

  const updateIngredienteMutation = useMutation({
    mutationFn: async (ingrediente: {
      id: number;
      nombre: string;
      unidad_medida: string;
      precio_unitario: number;
      stock_actual: number;
    }) => {
      const { id, ...data } = ingrediente;
      const { error } = await supabase
        .from("ingredientes")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-ingredientes"] });
      queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
      setShowIngredienteModal(false);
      setEditingIngrediente(null);
      setIngredienteFormData({
        nombre: "",
        unidad_medida: "kg",
        precio_unitario: 0,
        stock_actual: 0,
      });
    },
  });

  const deleteIngredienteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("ingredientes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-ingredientes"] });
      queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from("ingredientes")
        .update({ activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-ingredientes"] });
      queryClient.invalidateQueries({ queryKey: ["ingredientes"] });
    },
  });

  const resetForm = () => {
    setFormData({
      cliente_id: 0,
      valida_hasta: "",
      nombre_producto: "",
    });
    setCart([]);
    setCartIngredientes([]);
    setSearchProducto("");
    setSearchIngrediente("");
    setShowIngredientes(false);
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

  const addIngredienteToCart = (ingrediente: Ingrediente) => {
    const existingItem = cartIngredientes.find(
      (item) => item.ingrediente.id === ingrediente.id
    );

    if (existingItem) {
      updateIngredienteQuantity(ingrediente.id, existingItem.cantidad + 1);
    } else {
      setCartIngredientes([
        ...cartIngredientes,
        {
          ingrediente,
          cantidad: 1,
          subtotal: ingrediente.precio_unitario,
          notas: "",
        },
      ]);
    }
  };

  const updateIngredienteQuantity = (
    ingredienteId: number,
    newQuantity: number
  ) => {
    setCartIngredientes(
      cartIngredientes.map((item) => {
        if (item.ingrediente.id === ingredienteId) {
          const cantidad = Math.max(0.1, newQuantity);
          return {
            ...item,
            cantidad,
            subtotal: cantidad * item.ingrediente.precio_unitario,
          };
        }
        return item;
      })
    );
  };

  const updateIngredienteNotas = (ingredienteId: number, notas: string) => {
    setCartIngredientes(
      cartIngredientes.map((item) =>
        item.ingrediente.id === ingredienteId ? { ...item, notas } : item
      )
    );
  };

  const removeIngredienteFromCart = (ingredienteId: number) => {
    setCartIngredientes(
      cartIngredientes.filter((item) => item.ingrediente.id !== ingredienteId)
    );
  };

  const openDetalles = (cotizacion: CotizacionConDetalles) => {
    setSelectedCotizacion(cotizacion);
    setShowDetalles(true);
  };

  const openIngredientesManager = () => {
    setShowIngredientesManager(true);
  };

  const openIngredienteModal = (ingrediente?: Ingrediente) => {
    if (ingrediente) {
      setEditingIngrediente(ingrediente);
      setIngredienteFormData({
        nombre: ingrediente.nombre,
        unidad_medida: ingrediente.unidad_medida || "kg",
        precio_unitario: ingrediente.precio_unitario,
        stock_actual: ingrediente.stock_actual || 0,
      });
    }
    setShowIngredienteModal(true);
  };

  const handleIngredienteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIngrediente) {
      updateIngredienteMutation.mutate({
        id: editingIngrediente.id,
        ...ingredienteFormData,
      });
    } else {
      createIngredienteMutation.mutate(ingredienteFormData);
    }
  };

  const handleDeleteIngrediente = (id: number) => {
    if (
      confirm(
        "¿Estás seguro de eliminar este ingrediente? Esta acción no se puede deshacer."
      )
    ) {
      deleteIngredienteMutation.mutate(id);
    }
  };

  const handleDelete = (id: number) => {
    if (
      confirm("¿Eliminar esta cotización? Esta acción no se puede deshacer.")
    ) {
      deleteCotizacionMutation.mutate(id);
    }
  };

  const total =
    cart.reduce((sum, item) => sum + item.subtotal, 0) +
    cartIngredientes.reduce((sum, item) => sum + item.subtotal, 0);

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
            <div className="flex flex-col sm:flex-row gap-3 mt-4 lg:mt-0">
              <button
                onClick={openIngredientesManager}
                className="bg-gradient-to-r from-amber-200 to-orange-300 hover:from-amber-300 hover:to-orange-400 text-amber-800 px-6 py-3 rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium"
              >
                <Package className="w-5 h-5" />
                <span>Gestionar Ingredientes</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Nueva Cotización</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 mb-6 border border-purple-50">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cotización por ID, cliente o producto..."
                value={searchCotizacion}
                onChange={(e) => setSearchCotizacion(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setTipoCotizacion("personalizada")}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    tipoCotizacion === "personalizada"
                      ? "bg-gradient-to-r from-purple-200 to-pink-200 text-purple-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Personalizadas
                </button>
                <button
                  onClick={() => setTipoCotizacion("estandar")}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    tipoCotizacion === "estandar"
                      ? "bg-gradient-to-r from-blue-200 to-cyan-200 text-blue-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Estándar
                </button>
              </div>
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
            cotizaciones
              .filter((cot) => cot.tipo === tipoCotizacion)
              .map((cotizacion) => (
                <div
                  key={cotizacion.id}
                  className="bg-white rounded-2xl shadow-sm p-6 border border-purple-100 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 mb-1">
                        {cotizacion.tipo === "personalizada"
                          ? cotizacion.clientes?.nombre ||
                            "Cliente no especificado"
                          : cotizacion.nombre_producto ||
                            "Producto no especificado"}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Cotización #{cotizacion.id}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            cotizacion.tipo === "personalizada"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {cotizacion.tipo === "personalizada"
                            ? "Personalizada"
                            : "Estándar"}
                        </span>
                      </div>
                    </div>
                    {cotizacion.tipo === "personalizada" &&
                      getEstadoBadge(cotizacion.estado)}
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
                    {cotizacion.tipo === "personalizada" &&
                      cotizacion.valida_hasta && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Válida hasta:</span>
                          <span className="font-medium text-gray-800">
                            {new Date(
                              cotizacion.valida_hasta as string
                            ).toLocaleDateString("es-MX")}
                          </span>
                        </div>
                      )}
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
                {/* Selector de Tipo de Cotización */}
                <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tipo de Cotización *
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoCotizacion("personalizada");
                        setFormData({ ...formData, nombre_producto: "" });
                        setCartIngredientes([]);
                        setShowIngredientes(false);
                      }}
                      className={`flex-1 px-6 py-4 rounded-xl font-medium transition-all ${
                        tipoCotizacion === "personalizada"
                          ? "bg-gradient-to-r from-purple-200 to-pink-200 text-purple-800 shadow-md border-2 border-purple-300"
                          : "bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200"
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-bold text-lg">Personalizada</div>
                        <div className="text-xs mt-1 opacity-80">
                          Para cliente específico con productos y/o ingredientes
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoCotizacion("estandar");
                        setFormData({ ...formData, cliente_id: 0 });
                        setCart([]);
                        setShowIngredientes(true);
                      }}
                      className={`flex-1 px-6 py-4 rounded-xl font-medium transition-all ${
                        tipoCotizacion === "estandar"
                          ? "bg-gradient-to-r from-blue-200 to-cyan-200 text-blue-800 shadow-md border-2 border-blue-300"
                          : "bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200"
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-bold text-lg">Estándar</div>
                        <div className="text-xs mt-1 opacity-80">
                          Para producto con ingredientes específicos
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* Tabs para Productos e Ingredientes - Solo para Personalizada */}
                    {tipoCotizacion === "personalizada" && (
                      <div className="flex space-x-2 mb-4">
                        <button
                          onClick={() => setShowIngredientes(false)}
                          className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                            !showIngredientes
                              ? "bg-gradient-to-r from-purple-200 to-pink-200 text-purple-800"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <Package className="w-4 h-4 inline mr-2" />
                          Productos
                        </button>
                        <button
                          onClick={() => setShowIngredientes(true)}
                          className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                            showIngredientes
                              ? "bg-gradient-to-r from-amber-200 to-orange-200 text-amber-800"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <Egg className="w-4 h-4 inline mr-2" />
                          Ingredientes
                        </button>
                      </div>
                    )}

                    {/* Productos - Solo para Personalizada */}
                    {tipoCotizacion === "personalizada" && !showIngredientes ? (
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
                    ) : null}

                    {/* Ingredientes - Para ambos tipos pero obligatorio para Estándar */}
                    {(tipoCotizacion === "estandar" || showIngredientes) && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                        <div className="relative mb-4">
                          <Search className="absolute left-4 top-4 w-5 h-5 text-amber-400" />
                          <input
                            type="text"
                            placeholder="Buscar ingrediente..."
                            value={searchIngrediente}
                            onChange={(e) =>
                              setSearchIngrediente(e.target.value)
                            }
                            className="w-full pl-12 pr-4 py-3 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                          {ingredientes?.map((ingrediente) => (
                            <button
                              key={ingrediente.id}
                              onClick={() => addIngredienteToCart(ingrediente)}
                              className="bg-white hover:bg-gradient-to-br hover:from-amber-50 hover:to-orange-50 p-3 rounded-xl border border-amber-100 transition-colors duration-200 text-left"
                            >
                              <h4 className="font-semibold text-gray-800 text-sm mb-1 truncate">
                                {ingrediente.nombre}
                              </h4>
                              <p className="text-xs text-gray-500 mb-1">
                                {ingrediente.unidad_medida}
                              </p>
                              <p className="text-lg font-bold text-amber-700">
                                ${ingrediente.precio_unitario.toFixed(2)}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Campo Cliente - Solo para Personalizada */}
                    {tipoCotizacion === "personalizada" && (
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
                    )}

                    {/* Campo Nombre Producto - Solo para Estándar */}
                    {tipoCotizacion === "estandar" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre del Producto *
                        </label>
                        <input
                          type="text"
                          value={formData.nombre_producto}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nombre_producto: e.target.value,
                            })
                          }
                          required
                          placeholder="Ej: Pastel de chocolate 3 pisos"
                          className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Describe el producto para esta cotización
                        </p>
                      </div>
                    )}

                    {/* Campo Válida hasta - Solo para Personalizada */}
                    {tipoCotizacion === "personalizada" && (
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
                    )}

                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                        <ShoppingCart className="w-5 h-5 text-purple-600" />
                        <span>
                          Carrito ({cart.length + cartIngredientes.length})
                        </span>
                      </h3>

                      {cart.length === 0 && cartIngredientes.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {tipoCotizacion === "personalizada"
                            ? "Agrega productos o ingredientes"
                            : "Agrega ingredientes para el producto"}
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {/* Productos - Solo para Personalizada */}
                          {tipoCotizacion === "personalizada" &&
                            cart.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-purple-600 mb-2">
                                  PRODUCTOS
                                </p>
                                <div className="space-y-2">
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
                              </div>
                            )}

                          {/* Ingredientes */}
                          {cartIngredientes.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-600 mb-2">
                                INGREDIENTES
                              </p>
                              <div className="space-y-2">
                                {cartIngredientes.map((item) => (
                                  <div
                                    key={item.ingrediente.id}
                                    className="bg-white rounded-lg p-2"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                          {item.ingrediente.nombre}
                                        </p>
                                        <p className="text-xs text-amber-600 font-semibold">
                                          ${item.subtotal.toFixed(2)} (
                                          {item.ingrediente.unidad_medida})
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() =>
                                            updateIngredienteQuantity(
                                              item.ingrediente.id,
                                              item.cantidad - 0.5
                                            )
                                          }
                                          className="p-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="text-sm font-semibold w-10 text-center">
                                          {item.cantidad}
                                        </span>
                                        <button
                                          onClick={() =>
                                            updateIngredienteQuantity(
                                              item.ingrediente.id,
                                              item.cantidad + 0.5
                                            )
                                          }
                                          className="p-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            removeIngredienteFromCart(
                                              item.ingrediente.id
                                            )
                                          }
                                          className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Notas (ej: orgánico, sin gluten)..."
                                      value={item.notas}
                                      onChange={(e) =>
                                        updateIngredienteNotas(
                                          item.ingrediente.id,
                                          e.target.value
                                        )
                                      }
                                      className="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-200 outline-none"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                        tipoCotizacion === "personalizada"
                          ? (cart.length === 0 &&
                              cartIngredientes.length === 0) ||
                            !formData.cliente_id ||
                            !formData.valida_hasta ||
                            createCotizacionMutation.isPending
                          : cartIngredientes.length === 0 ||
                            !formData.nombre_producto ||
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
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedCotizacion.tipo === "personalizada"
                      ? selectedCotizacion.clientes?.nombre ||
                        "Cliente no especificado"
                      : selectedCotizacion.nombre_producto ||
                        "Producto no especificado"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Cotización #{selectedCotizacion.id}
                  </p>
                </div>
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
                  {selectedCotizacion.tipo === "personalizada" && (
                    <div>
                      <p className="text-sm text-gray-600">Cliente</p>
                      <p className="font-semibold text-gray-800">
                        {selectedCotizacion.clientes?.nombre || "N/A"}
                      </p>
                    </div>
                  )}
                  {selectedCotizacion.tipo === "estandar" && (
                    <div>
                      <p className="text-sm text-gray-600">Producto</p>
                      <p className="font-semibold text-gray-800">
                        {selectedCotizacion.nombre_producto || "N/A"}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Tipo</p>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        selectedCotizacion.tipo === "personalizada"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {selectedCotizacion.tipo === "personalizada"
                        ? "Personalizada"
                        : "Estándar"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(
                        selectedCotizacion.created_at
                      ).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  {selectedCotizacion.tipo === "personalizada" &&
                    selectedCotizacion.valida_hasta && (
                      <div>
                        <p className="text-sm text-gray-600">Válida hasta</p>
                        <p className="font-semibold text-gray-800">
                          {new Date(
                            selectedCotizacion.valida_hasta as string
                          ).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                    )}
                  {selectedCotizacion.tipo === "personalizada" && (
                    <div>
                      <p className="text-sm text-gray-600">Estado</p>
                      {getEstadoBadge(selectedCotizacion.estado)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      ${selectedCotizacion.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                {detallesCotizacion && detallesCotizacion.length > 0 && (
                  <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <span>Productos</span>
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
                                $
                                {(item.cantidad * item.precio_unitario).toFixed(
                                  2
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {detallesIngredientes && detallesIngredientes.length > 0 && (
                  <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                      <Egg className="w-5 h-5 text-amber-600" />
                      <span>Ingredientes</span>
                    </h3>
                    <div className="border border-amber-200 rounded-xl overflow-hidden mb-6">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-amber-50 to-orange-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                              Ingrediente
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                              Cantidad
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                              Precio
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                              Notas
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">
                              Subtotal
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detallesIngredientes?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="px-6 py-4 text-sm font-medium text-gray-800">
                                {item.ingredientes?.nombre || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {item.cantidad}{" "}
                                {item.ingredientes?.unidad_medida}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                ${item.precio_unitario.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 italic">
                                {item.notas || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-emerald-700 text-right">
                                $
                                {(item.cantidad * item.precio_unitario).toFixed(
                                  2
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {selectedCotizacion.tipo === "personalizada" &&
                  selectedCotizacion.estado === "pendiente" && (
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

        {/* Ingredientes Manager Modal */}
        {showIngredientesManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Package className="w-7 h-7 text-amber-600" />
                  Gestión de Ingredientes
                </h2>
                <button
                  onClick={() => setShowIngredientesManager(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-gray-600">
                    Administra tu catálogo de ingredientes
                  </p>
                  <button
                    onClick={() => openIngredienteModal()}
                    className="bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-sm font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Ingrediente</span>
                  </button>
                </div>

                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-amber-50 to-orange-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Unidad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Precio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allIngredientes && allIngredientes.length > 0 ? (
                        allIngredientes.map((ingrediente) => (
                          <tr
                            key={ingrediente.id}
                            className="hover:bg-amber-50/30"
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-800">
                              {ingrediente.nombre}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {ingrediente.unidad_medida}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              ${ingrediente.precio_unitario.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {ingrediente.stock_actual?.toFixed(2) || 0}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() =>
                                  toggleActivoMutation.mutate({
                                    id: ingrediente.id,
                                    activo: !ingrediente.activo,
                                  })
                                }
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  ingrediente.activo
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {ingrediente.activo ? "Activo" : "Inactivo"}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() =>
                                    openIngredienteModal(ingrediente)
                                  }
                                  className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteIngrediente(ingrediente.id)
                                  }
                                  className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-12 text-center text-gray-500"
                          >
                            No hay ingredientes registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Ingrediente Modal */}
        {showIngredienteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingIngrediente ? "Editar" : "Nuevo"} Ingrediente
                </h2>
                <button
                  onClick={() => {
                    setShowIngredienteModal(false);
                    setEditingIngrediente(null);
                    setIngredienteFormData({
                      nombre: "",
                      unidad_medida: "kg",
                      precio_unitario: 0,
                      stock_actual: 0,
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleIngredienteSubmit} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={ingredienteFormData.nombre}
                      onChange={(e) =>
                        setIngredienteFormData({
                          ...ingredienteFormData,
                          nombre: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none"
                      placeholder="Ej: Harina"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unidad de Medida *
                    </label>
                    <select
                      value={ingredienteFormData.unidad_medida}
                      onChange={(e) =>
                        setIngredienteFormData({
                          ...ingredienteFormData,
                          unidad_medida: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none"
                      required
                    >
                      <option value="kg">Kilogramo (kg)</option>
                      <option value="gr">Gramo (gr)</option>
                      <option value="lt">Litro (lt)</option>
                      <option value="ml">Mililitro (ml)</option>
                      <option value="pz">Pieza (pz)</option>
                      <option value="taza">Taza</option>
                      <option value="cdta">Cucharadita (cdta)</option>
                      <option value="cda">Cucharada (cda)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Precio Unitario *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={ingredienteFormData.precio_unitario}
                        onChange={(e) =>
                          setIngredienteFormData({
                            ...ingredienteFormData,
                            precio_unitario: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock Actual
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={ingredienteFormData.stock_actual}
                        onChange={(e) =>
                          setIngredienteFormData({
                            ...ingredienteFormData,
                            stock_actual: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIngredienteModal(false);
                      setEditingIngrediente(null);
                      setIngredienteFormData({
                        nombre: "",
                        unidad_medida: "kg",
                        precio_unitario: 0,
                        stock_actual: 0,
                      });
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl transition-all shadow-sm font-medium"
                  >
                    {editingIngrediente ? "Actualizar" : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
