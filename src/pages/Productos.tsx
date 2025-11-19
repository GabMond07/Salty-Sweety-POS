import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Product, Categoria } from "../types";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  X,
  Save,
  Filter,
  FolderPlus,
  Tag,
} from "lucide-react";

type ModalMode = "add" | "edit" | null;
type CategoriaModalMode = "list" | "add" | "edit" | null;

export default function Productos() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<number | "all">(
    "all"
  );
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Estados para gestión de categorías
  const [categoriaModalMode, setCategoriaModalMode] =
    useState<CategoriaModalMode>(null);
  const [selectedCategoriaMod, setSelectedCategoriaMod] =
    useState<Categoria | null>(null);
  const [categoriaFormData, setCategoriaFormData] = useState({
    nombre: "",
    descripcion: "",
  });
  const [showDeleteCategoriaConfirm, setShowDeleteCategoriaConfirm] =
    useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(
    null
  );

  // Form state
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio_venta: 0,
    precio_costo: 0,
    stock_actual: 0,
    stock_minimo: 0,
    sku: "",
    categoria_id: null as number | null,
  });

  // Query para productos
  const { data: productos, isLoading: loadingProductos } = useQuery<Product[]>({
    queryKey: ["productos", searchTerm, selectedCategoria],
    queryFn: async () => {
      let query = supabase.from("productos").select("*").order("nombre");

      if (searchTerm) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
        );
      }

      if (selectedCategoria !== "all") {
        query = query.eq("categoria_id", selectedCategoria);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Query para categorías
  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation para crear producto
  const createProductMutation = useMutation({
    mutationFn: async (newProduct: typeof formData) => {
      const { data, error } = await supabase
        .from("productos")
        .insert([newProduct])
        .select()
        .single();

      if (error) throw error;

      // Registrar movimiento de inventario inicial
      if (newProduct.stock_actual > 0) {
        await supabase.from("movimientos_inventario").insert({
          producto_id: data.id,
          tipo_movimiento: "ajuste",
          cantidad: newProduct.stock_actual,
          justificacion: "Stock inicial",
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
      closeModal();
    },
  });

  // Mutation para actualizar producto
  const updateProductMutation = useMutation({
    mutationFn: async (updatedProduct: typeof formData & { id: number }) => {
      const { id, ...updateData } = updatedProduct;

      // Obtener stock anterior
      const { data: oldProduct } = await supabase
        .from("productos")
        .select("stock_actual")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("productos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Registrar movimiento si cambió el stock
      if (oldProduct && oldProduct.stock_actual !== updateData.stock_actual) {
        const diferencia = updateData.stock_actual - oldProduct.stock_actual;
        await supabase.from("movimientos_inventario").insert({
          producto_id: id,
          tipo_movimiento: "ajuste",
          cantidad: diferencia,
          justificacion: "Ajuste manual de inventario",
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
      closeModal();
    },
  });

  // Mutation para eliminar producto
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    },
  });

  const openAddModal = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      precio_venta: 0,
      precio_costo: 0,
      stock_actual: 0,
      stock_minimo: 0,
      sku: "",
      categoria_id: null,
    });
    setModalMode("add");
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || "",
      precio_venta: product.precio_venta,
      precio_costo: product.precio_costo,
      stock_actual: product.stock_actual,
      stock_minimo: product.stock_minimo,
      sku: product.sku || "",
      categoria_id: product.categoria_id || null,
    });
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === "add") {
      createProductMutation.mutate(formData);
    } else if (modalMode === "edit" && selectedProduct) {
      updateProductMutation.mutate({ ...formData, id: selectedProduct.id });
    }
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteProductMutation.mutate(productToDelete.id);
    }
  };

  // Funciones para gestión de categorías
  const createCategoriaMutation = useMutation({
    mutationFn: async (newCategoria: typeof categoriaFormData) => {
      const { data, error } = await supabase
        .from("categorias")
        .insert([newCategoria])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      closeCategoriaModal();
    },
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: async (
      updatedCategoria: typeof categoriaFormData & { id: number }
    ) => {
      const { id, ...updateData } = updatedCategoria;
      const { data, error } = await supabase
        .from("categorias")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      closeCategoriaModal();
    },
  });

  const deleteCategoriaMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      setShowDeleteCategoriaConfirm(false);
      setCategoriaToDelete(null);
    },
  });

  const openCategoriaListModal = () => {
    setCategoriaModalMode("list");
  };

  const openAddCategoriaModal = () => {
    setCategoriaFormData({ nombre: "", descripcion: "" });
    setCategoriaModalMode("add");
  };

  const openEditCategoriaModal = (categoria: Categoria) => {
    setSelectedCategoriaMod(categoria);
    setCategoriaFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || "",
    });
    setCategoriaModalMode("edit");
  };

  const closeCategoriaModal = () => {
    setCategoriaModalMode(null);
    setSelectedCategoriaMod(null);
  };

  const handleCategoriaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoriaModalMode === "add") {
      createCategoriaMutation.mutate(categoriaFormData);
    } else if (categoriaModalMode === "edit" && selectedCategoriaMod) {
      updateCategoriaMutation.mutate({
        ...categoriaFormData,
        id: selectedCategoriaMod.id,
      });
    }
  };

  const handleDeleteCategoria = (categoria: Categoria) => {
    setCategoriaToDelete(categoria);
    setShowDeleteCategoriaConfirm(true);
  };

  const confirmDeleteCategoria = () => {
    if (categoriaToDelete) {
      deleteCategoriaMutation.mutate(categoriaToDelete.id);
    }
  };

  const stockBajoCount =
    productos?.filter((p) => p.stock_actual <= p.stock_minimo).length || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Gestión de Inventario
        </h1>
        <p className="text-gray-600">Administra tus productos y stock</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-800">
                {productos?.length || 0}
              </p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valor Inventario</p>
              <p className="text-2xl font-bold text-green-600">
                $
                {productos
                  ?.reduce((sum, p) => sum + p.precio_costo * p.stock_actual, 0)
                  .toFixed(2) || 0}
              </p>
            </div>
            <Package className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">
                {stockBajoCount}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <select
              value={selectedCategoria}
              onChange={(e) =>
                setSelectedCategoria(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
            >
              <option value="all">Todas las categorías</option>
              {categorias?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Add Button */}
          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Agregar Producto</span>
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={openCategoriaListModal}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Tag className="w-5 h-5" />
            <span>Gestionar Categorías</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loadingProductos ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando productos...</p>
          </div>
        ) : productos && productos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Costo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Venta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productos.map((producto) => (
                  <tr
                    key={producto.id}
                    className={`hover:bg-gray-50 ${
                      producto.stock_actual <= producto.stock_minimo
                        ? "bg-red-50"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {producto.nombre}
                        </p>
                        {producto.descripcion && (
                          <p className="text-sm text-gray-500">
                            {producto.descripcion}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {producto.sku || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${producto.precio_costo.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      ${producto.precio_venta.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">
                          {producto.stock_actual} unidades
                        </p>
                        <p className="text-gray-500">
                          Mín: {producto.stock_minimo}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {producto.stock_actual <= producto.stock_minimo ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Stock Bajo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Disponible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(producto)}
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(producto)}
                        className="text-red-600 hover:text-red-800 inline-flex items-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No hay productos registrados</p>
            <p className="text-sm">
              Comienza agregando tu primer producto al inventario
            </p>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {modalMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {modalMode === "add" ? "Agregar Producto" : "Editar Producto"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) =>
                      setFormData({ ...formData, descripcion: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.categoria_id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        categoria_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Sin categoría</option>
                    {categorias?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio de Costo *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.precio_costo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precio_costo: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio de Venta *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.precio_venta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precio_venta: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Actual *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock_actual}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_actual: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Mínimo *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock_minimo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_minimo: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    createProductMutation.isPending ||
                    updateProductMutation.isPending
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  <span>
                    {createProductMutation.isPending ||
                    updateProductMutation.isPending
                      ? "Guardando..."
                      : "Guardar"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && productToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">
                Confirmar Eliminación
              </h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar el producto{" "}
              <span className="font-semibold">{productToDelete.nombre}</span>?
              Esta acción no se puede deshacer.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setProductToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteProductMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span>
                  {deleteProductMutation.isPending
                    ? "Eliminando..."
                    : "Eliminar"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Categorías */}
      {categoriaModalMode === "list" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                Gestión de Categorías
              </h2>
              <button
                onClick={closeCategoriaModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <button
                onClick={openAddCategoriaModal}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors mb-4"
              >
                <FolderPlus className="w-5 h-5" />
                <span>Agregar Nueva Categoría</span>
              </button>

              {categorias && categorias.length > 0 ? (
                <div className="space-y-3">
                  {categorias.map((categoria) => (
                    <div
                      key={categoria.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">
                            {categoria.nombre}
                          </h3>
                          {categoria.descripcion && (
                            <p className="text-sm text-gray-600">
                              {categoria.descripcion}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => openEditCategoriaModal(categoria)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategoria(categoria)}
                            className="text-red-600 hover:text-red-800 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Tag className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No hay categorías registradas</p>
                  <p className="text-sm">
                    Comienza agregando tu primera categoría
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Categoría */}
      {(categoriaModalMode === "add" || categoriaModalMode === "edit") && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {categoriaModalMode === "add"
                  ? "Agregar Categoría"
                  : "Editar Categoría"}
              </h2>
              <button
                onClick={() => setCategoriaModalMode("list")}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCategoriaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  value={categoriaFormData.nombre}
                  onChange={(e) =>
                    setCategoriaFormData({
                      ...categoriaFormData,
                      nombre: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={categoriaFormData.descripcion}
                  onChange={(e) =>
                    setCategoriaFormData({
                      ...categoriaFormData,
                      descripcion: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCategoriaModalMode("list")}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    createCategoriaMutation.isPending ||
                    updateCategoriaMutation.isPending
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  <span>
                    {createCategoriaMutation.isPending ||
                    updateCategoriaMutation.isPending
                      ? "Guardando..."
                      : "Guardar"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación de Categoría */}
      {showDeleteCategoriaConfirm && categoriaToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">
                Confirmar Eliminación
              </h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar la categoría{" "}
              <span className="font-semibold">{categoriaToDelete.nombre}</span>?
              Los productos asociados quedarán sin categoría.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteCategoriaConfirm(false);
                  setCategoriaToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCategoria}
                disabled={deleteCategoriaMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span>
                  {deleteCategoriaMutation.isPending
                    ? "Eliminando..."
                    : "Eliminar"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
