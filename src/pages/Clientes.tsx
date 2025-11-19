import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Cliente } from "../types";
import {
  Users,
  Search,
  Mail,
  Phone,
  Edit2,
  Trash2,
  X,
  Save,
  UserPlus,
  StickyNote,
} from "lucide-react";

export default function Clientes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    notas_cliente: "",
  });

  const { data: clientes, isLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes", searchTerm],
    queryFn: async () => {
      let query = supabase.from("clientes").select("*").order("nombre");

      if (searchTerm) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const createClienteMutation = useMutation({
    mutationFn: async (newCliente: Omit<Cliente, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert(newCliente)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      resetForm();
      setShowModal(false);
    },
  });

  const updateClienteMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<Cliente>;
    }) => {
      const { data, error } = await supabase
        .from("clientes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      resetForm();
      setShowModal(false);
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      email: "",
      telefono: "",
      notas_cliente: "",
    });
    setEditingCliente(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nombre: cliente.nombre,
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      notas_cliente: cliente.notas_cliente || "",
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim()) return;

    if (editingCliente) {
      updateClienteMutation.mutate({
        id: editingCliente.id,
        updates: formData,
      });
    } else {
      createClienteMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) {
      deleteClienteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-6 lg:p-8 rounded-2xl shadow-sm border border-pink-50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                Gestión de Clientes
              </h1>
              <p className="text-gray-600 font-medium">
                Administra tu base de clientes
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="mt-4 lg:mt-0 bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-md font-medium"
            >
              <UserPlus className="w-5 h-5" />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 mb-6 border border-purple-50">
          <div className="relative">
            <Search className="absolute left-4 top-4 w-5 h-5 text-purple-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl h-48 animate-pulse"
              />
            ))
          ) : clientes && clientes.length > 0 ? (
            clientes.map((cliente) => (
              <div
                key={cliente.id}
                className="bg-white rounded-2xl shadow-sm p-6 border border-purple-100 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-3 rounded-xl">
                      <Users className="w-6 h-6 text-purple-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {cliente.nombre}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Cliente #{cliente.id}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {cliente.email && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.telefono && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>{cliente.telefono}</span>
                    </div>
                  )}
                  {cliente.notas_cliente && (
                    <div className="flex items-start space-x-2 text-sm text-gray-600">
                      <StickyNote className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">
                        {cliente.notas_cliente}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(cliente)}
                    className="flex-1 bg-gradient-to-r from-blue-100 to-purple-100 hover:from-blue-200 hover:to-purple-200 text-blue-700 px-4 py-2 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(cliente.id)}
                    className="bg-gradient-to-r from-red-100 to-red-200 hover:from-red-200 hover:to-red-300 text-red-700 px-4 py-2 rounded-xl transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">
                No hay clientes registrados
              </p>
              <p className="text-gray-400 text-sm">
                Comienza agregando tu primer cliente
              </p>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-3">
                  {editingCliente ? (
                    <>
                      <Edit2 className="w-6 h-6 text-blue-600" />
                      <span>Editar Cliente</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-6 h-6 text-emerald-600" />
                      <span>Nuevo Cliente</span>
                    </>
                  )}
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

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="5551234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas
                  </label>
                  <textarea
                    value={formData.notas_cliente}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notas_cliente: e.target.value,
                      })
                    }
                    rows={4}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
                    placeholder="Información adicional sobre el cliente..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createClienteMutation.isPending ||
                      updateClienteMutation.isPending
                    }
                    className="flex-1 bg-gradient-to-r from-emerald-200 to-emerald-300 hover:from-emerald-300 hover:to-emerald-400 text-emerald-800 px-6 py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 transition-all shadow-sm font-medium"
                  >
                    <Save className="w-5 h-5" />
                    <span>
                      {editingCliente ? "Guardar Cambios" : "Crear Cliente"}
                    </span>
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
