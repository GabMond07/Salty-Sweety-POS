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

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio_venta: 0,
    precio_costo: 0,
    stock_actual: 0,
    stock_minimo: 0,
    sku: "",
    categoria_id: null as number | null,
    imagen_url: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const createProductMutation = useMutation({
    mutationFn: async (newProduct: typeof formData) => {
      let imagenUrl = newProduct.imagen_url;
      if (selectedFile) {
        imagenUrl = await uploadImage(selectedFile);
      }

      const { data, error } = await supabase
        .from("productos")
        .insert([{ ...newProduct, imagen_url: imagenUrl }])
        .select()
        .single();

      if (error) throw error;

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

  const updateProductMutation = useMutation({
    mutationFn: async (updatedProduct: typeof formData & { id: number }) => {
      const { id, ...updateData } = updatedProduct;

      let imagenUrl = updateData.imagen_url;
      if (selectedFile) {
        imagenUrl = await uploadImage(selectedFile);
      }

      const { data: oldProduct } = await supabase
        .from("productos")
        .select("stock_actual")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("productos")
        .update({ ...updateData, imagen_url: imagenUrl })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

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

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await supabase
        .from("movimientos_inventario")
        .delete()
        .eq("producto_id", id);

      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) {
        if (error.code === "23503") {
          throw new Error(
            "No se puede eliminar el producto porque tiene ventas asociadas"
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["stockBajo"] });
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    },
    onError: (error: any) => {
      alert(error.message || "Error al eliminar el producto");
    },
  });

  const generateSKU = () => {
    const prefix = "SKU";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Por favor selecciona un archivo de imagen válido");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert("La imagen no debe superar los 2MB");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `productos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("productos-imagenes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("productos-imagenes").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error al subir imagen:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      precio_venta: 0,
      precio_costo: 0,
      stock_actual: 0,
      stock_minimo: 0,
      sku: generateSKU(),
      categoria_id: null,
      imagen_url: "",
    });
    setSelectedFile(null);
    setImagePreview("");
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
      imagen_url: product.imagen_url || "",
    });
    setSelectedFile(null);
    setImagePreview(product.imagen_url || "");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProduct(null);
    setSelectedFile(null);
    setImagePreview("");
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
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-6 lg:p-8 rounded-2xl shadow-sm border border-pink-50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                Gestión de Inventario
              </h1>
              <p className="text-gray-600 font-medium">
                Administra productos y stock con facilidad
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center space-x-4">
              <Package className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-gray-600">
                {stockBajoCount} en stock bajo
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Productos
                </p>
                <p className="text-3xl font-bold text-gray-800">
                  {productos?.length || 0}
                </p>
              </div>
              <Package className="w-12 h-12 text-emerald-400" />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Valor Inventario
                </p>
                <p className="text-3xl font-bold text-blue-700">
                  $
                  {productos
                    ?.reduce(
                      (sum, p) => sum + p.precio_costo * p.stock_actual,
                      0
                    )
                    .toFixed(2) || 0}
                </p>
              </div>
              <Package className="w-12 h-12 text-blue-400" />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
                <p className="text-3xl font-bold text-red-700">
                  {stockBajoCount}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-purple-50 sticky top-4 z-10">
          <div className="flex flex-col md:flex-row gap-4 items-center md:items-start">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-purple-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="relative flex-1 md:flex-none md:w-48">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-purple-400" />
              <select
                value={selectedCategoria}
                onChange={(e) =>
                  setSelectedCategoria(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none appearance-none bg-white"
              >
                <option value="all">Todas las categorías</option>
                {categorias?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={openAddModal}
                className="bg-gradient-to-r from-pink-200 to-purple-200 hover:from-pink-300 hover:to-purple-300 text-purple-700 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Agregar Producto</span>
              </button>

              <button
                onClick={openCategoriaListModal}
                className="bg-gradient-to-r from-blue-200 to-emerald-200 hover:from-blue-300 hover:to-emerald-300 text-blue-700 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium"
              >
                <Tag className="w-5 h-5" />
                <span>Categorías</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-50">
          {loadingProductos ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Cargando productos...</p>
            </div>
          ) : productos && productos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-100">
                <thead className="bg-gradient-to-r from-pink-50 to-purple-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Imagen
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Costo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Venta
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productos.map((producto, index) => (
                    <tr
                      key={producto.id}
                      className={`transition-all duration-200 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-25"
                      } ${
                        producto.stock_actual <= producto.stock_minimo
                          ? "bg-red-25 border-l-4 border-red-100"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        {producto.imagen_url ? (
                          <img
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            className="w-14 h-14 object-cover rounded-xl shadow-sm"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                            <Package className="w-6 h-6 text-purple-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {producto.nombre}
                          </p>
                          {producto.descripcion && (
                            <p className="text-xs text-gray-500 truncate max-w-32">
                              {producto.descripcion}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 font-medium">
                          {producto.sku || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 font-medium">
                          ${producto.precio_costo.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-emerald-700">
                          ${producto.precio_venta.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {producto.stock_actual} un.
                          </p>
                          <p className="text-xs text-gray-500">
                            Mín: {producto.stock_minimo}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {producto.stock_actual <= producto.stock_minimo ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(producto)}
                          className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-xl transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(producto)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all duration-200"
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
            <div className="p-12 text-center text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-40 text-purple-300" />
              <p className="text-xl font-medium text-gray-600 mb-2">
                No hay productos aún
              </p>
              <p className="text-sm">Agrega tu primer producto para empezar</p>
            </div>
          )}
        </div>

        {modalMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">
                  {modalMode === "add" ? "Nuevo Producto" : "Editar Producto"}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={formData.descripcion}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          descripcion: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Imagen
                    </label>
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          JPG, PNG, GIF. Máx 2MB
                        </p>
                      </div>
                      {imagePreview && (
                        <div className="relative w-28 h-28 border-2 border-purple-200 rounded-xl overflow-hidden flex-shrink-0">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              setImagePreview("");
                              setFormData({ ...formData, imagen_url: "" });
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SKU {modalMode === "add" && "(auto)"}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                        className="flex-1 px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none bg-gray-50"
                        readOnly={modalMode === "add"}
                      />
                      {modalMode === "add" && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, sku: generateSKU() })
                          }
                          className="px-3 py-3 bg-purple-200 hover:bg-purple-300 text-purple-700 rounded-xl transition-all text-sm font-medium"
                        >
                          ↻
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                    >
                      <option value="">Sin categoría</option>
                      {categorias?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Costo *
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
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Venta *
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
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createProductMutation.isPending ||
                      updateProductMutation.isPending ||
                      uploadingImage
                    }
                    className="bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-purple-700 px-6 py-3 rounded-xl flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 shadow-sm font-medium"
                  >
                    <Save className="w-5 h-5" />
                    <span>
                      {uploadingImage
                        ? "Subiendo..."
                        : createProductMutation.isPending ||
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

        {showDeleteConfirm && productToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-100 p-3 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  Confirmar Eliminación
                </h3>
              </div>

              <p className="text-gray-600 mb-6">
                ¿Eliminar{" "}
                <span className="font-semibold text-gray-800">
                  {productToDelete.nombre}
                </span>
                ? No se puede deshacer.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setProductToDelete(null);
                  }}
                  className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteProductMutation.isPending}
                  className="bg-gradient-to-r from-red-200 to-red-300 hover:from-red-300 hover:to-red-400 text-red-700 px-6 py-3 rounded-xl flex items-center space-x-2 disabled:opacity-50 transition-all shadow-sm font-medium"
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

        {categoriaModalMode === "list" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">Categorías</h2>
                <button
                  onClick={closeCategoriaModal}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <button
                  onClick={openAddCategoriaModal}
                  className="w-full bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-purple-700 py-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 shadow-sm font-medium mb-6"
                >
                  <FolderPlus className="w-5 h-5" />
                  <span>Nueva Categoría</span>
                </button>

                {categorias && categorias.length > 0 ? (
                  <div className="space-y-3">
                    {categorias.map((categoria) => (
                      <div
                        key={categoria.id}
                        className="border border-gray-100 rounded-xl p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
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
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-xl transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategoria(categoria)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all"
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
                    <Tag className="w-16 h-16 mx-auto mb-4 opacity-40 text-purple-300" />
                    <p className="text-lg font-medium">Sin categorías</p>
                    <p className="text-sm">Agrega una para organizar mejor</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {(categoriaModalMode === "add" || categoriaModalMode === "edit") && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">
                  {categoriaModalMode === "add"
                    ? "Nueva Categoría"
                    : "Editar Categoría"}
                </h2>
                <button
                  onClick={() => setCategoriaModalMode("list")}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCategoriaSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre *
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
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCategoriaModalMode("list")}
                    className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createCategoriaMutation.isPending ||
                      updateCategoriaMutation.isPending
                    }
                    className="bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-purple-700 px-6 py-3 rounded-xl flex items-center space-x-2 disabled:opacity-50 transition-all shadow-sm font-medium"
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

        {showDeleteCategoriaConfirm && categoriaToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-100 p-3 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  Confirmar Eliminación
                </h3>
              </div>

              <p className="text-gray-600 mb-6">
                ¿Eliminar{" "}
                <span className="font-semibold text-gray-800">
                  {categoriaToDelete.nombre}
                </span>
                ? Productos quedarán sin categoría.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteCategoriaConfirm(false);
                    setCategoriaToDelete(null);
                  }}
                  className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteCategoria}
                  disabled={deleteCategoriaMutation.isPending}
                  className="bg-gradient-to-r from-red-200 to-red-300 hover:from-red-300 hover:to-red-400 text-red-700 px-6 py-3 rounded-xl flex items-center space-x-2 disabled:opacity-50 transition-all shadow-sm font-medium"
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
    </div>
  );
}
