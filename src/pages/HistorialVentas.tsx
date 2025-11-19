import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Venta, VentaItem, Product, Cliente } from '../types';
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
} from 'lucide-react';

type PeriodoFiltro = 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado';

interface VentaConDetalles extends Venta {
  cliente?: Cliente;
  items?: (VentaItem & { producto?: Product })[];
}

export default function HistorialVentas() {
  const queryClient = useQueryClient();
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>('mes');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState<string>('todos');
  const [clienteFiltro, setClienteFiltro] = useState<number | 'todos'>('todos');
  const [selectedVenta, setSelectedVenta] = useState<VentaConDetalles | null>(null);
  const [showDetalles, setShowDetalles] = useState(false);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);
  const [ventaToAnular, setVentaToAnular] = useState<Venta | null>(null);

  // Calcular fechas según el periodo
  const getFechaRange = () => {
    const now = new Date();
    let inicio = new Date();
    let fin = new Date();

    switch (periodoFiltro) {
      case 'hoy':
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(23, 59, 59, 999);
        break;
      case 'semana':
        inicio.setDate(now.getDate() - 7);
        break;
      case 'mes':
        inicio.setMonth(now.getMonth() - 1);
        break;
      case 'año':
        inicio.setFullYear(now.getFullYear() - 1);
        break;
      case 'personalizado':
        if (fechaInicio && fechaFin) {
          return {
            inicio: new Date(fechaInicio).toISOString(),
            fin: new Date(fechaFin + 'T23:59:59').toISOString(),
          };
        }
        break;
    }

    return {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
    };
  };

  // Query para ventas con filtros
  const { data: ventas, isLoading: loadingVentas } = useQuery<Venta[]>({
    queryKey: ['ventas', periodoFiltro, fechaInicio, fechaFin, metodoPagoFiltro, clienteFiltro],
    queryFn: async () => {
      const { inicio, fin } = getFechaRange();
      let query = supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .gte('created_at', inicio)
        .lte('created_at', fin)
        .order('created_at', { ascending: false });

      if (metodoPagoFiltro !== 'todos') {
        query = query.eq('metodo_pago', metodoPagoFiltro);
      }

      if (clienteFiltro !== 'todos') {
        query = query.eq('cliente_id', clienteFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Query para clientes
  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data || [];
    },
  });

  // Query para detalles de venta
  const { data: detallesVenta } = useQuery<VentaItem[]>({
    queryKey: ['venta-items', selectedVenta?.id],
    queryFn: async () => {
      if (!selectedVenta) return [];
      const { data, error } = await supabase
        .from('venta_items')
        .select('*, productos(*)')
        .eq('venta_id', selectedVenta.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedVenta,
  });

  // Mutation para anular venta
  const anularVentaMutation = useMutation({
    mutationFn: async (ventaId: number) => {
      // Obtener items de la venta
      const { data: items, error: itemsError } = await supabase
        .from('venta_items')
        .select('producto_id, cantidad')
        .eq('venta_id', ventaId);

      if (itemsError) throw itemsError;

      // Devolver stock a los productos
      for (const item of items || []) {
        const { data: producto } = await supabase
          .from('productos')
          .select('stock_actual')
          .eq('id', item.producto_id)
          .single();

        if (producto) {
          await supabase
            .from('productos')
            .update({
              stock_actual: producto.stock_actual + item.cantidad,
            })
            .eq('id', item.producto_id);

          // Registrar movimiento de inventario
          await supabase.from('movimientos_inventario').insert({
            producto_id: item.producto_id,
            tipo_movimiento: 'devolucion',
            cantidad: item.cantidad,
            justificacion: `Anulación de venta #${ventaId}`,
          });
        }
      }

      // Eliminar items de venta
      await supabase.from('venta_items').delete().eq('venta_id', ventaId);

      // Eliminar venta
      const { error } = await supabase.from('ventas').delete().eq('id', ventaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['ventasHoy'] });
      queryClient.invalidateQueries({ queryKey: ['ventasMes'] });
      queryClient.invalidateQueries({ queryKey: ['stockBajo'] });
      setShowAnularConfirm(false);
      setVentaToAnular(null);
    },
  });

  // Calcular estadísticas
  const totalVentas = ventas?.reduce((sum, v) => sum + v.total, 0) || 0;
  const cantidadVentas = ventas?.length || 0;
  const promedioVenta = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;
  const ventasEfectivo = ventas?.filter((v) => v.metodo_pago === 'efectivo').length || 0;
  const ventasTarjeta = ventas?.filter((v) => v.metodo_pago === 'tarjeta').length || 0;

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

    const headers = ['ID', 'Fecha', 'Cliente', 'Total', 'Método de Pago'];
    const rows = ventas.map((v) => [
      v.id,
      new Date(v.created_at).toLocaleString('es-MX'),
      (v as any).clientes?.nombre || 'Cliente general',
      v.total.toFixed(2),
      v.metodo_pago,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${periodoFiltro}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Historial de Ventas
        </h1>
        <p className="text-gray-600">Consulta y gestiona todas tus ventas</p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Ventas</p>
              <p className="text-2xl font-bold text-green-600">
                ${totalVentas.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cantidad</p>
              <p className="text-2xl font-bold text-blue-600">{cantidadVentas}</p>
            </div>
            <FileText className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Promedio</p>
              <p className="text-2xl font-bold text-purple-600">
                ${promedioVenta.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Métodos</p>
              <p className="text-sm font-semibold text-gray-800">
                Efectivo: {ventasEfectivo} | Tarjeta: {ventasTarjeta}
              </p>
            </div>
            <CreditCard className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Periodo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periodo
            </label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value as PeriodoFiltro)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="hoy">Hoy</option>
              <option value="semana">Última semana</option>
              <option value="mes">Último mes</option>
              <option value="año">Último año</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {/* Fechas personalizadas */}
          {periodoFiltro === 'personalizado' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          {/* Método de Pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPagoFiltro}
              onChange={(e) => setMetodoPagoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              value={clienteFiltro}
              onChange={(e) =>
                setClienteFiltro(
                  e.target.value === 'todos' ? 'todos' : Number(e.target.value)
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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

        <div className="mt-4">
          <button
            onClick={exportarCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Exportar a CSV</span>
          </button>
        </div>
      </div>

      {/* Tabla de Ventas */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loadingVentas ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando ventas...</p>
          </div>
        ) : ventas && ventas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Método de Pago
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      #{venta.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(venta.created_at).toLocaleString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {(venta as any).clientes?.nombre || 'Cliente general'}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">
                      ${venta.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          venta.metodo_pago === 'efectivo'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {venta.metodo_pago === 'efectivo' ? (
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
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAnular(venta)}
                        className="text-red-600 hover:text-red-800 inline-flex items-center"
                        title="Anular venta"
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
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No hay ventas en este periodo</p>
            <p className="text-sm">Intenta cambiar los filtros</p>
          </div>
        )}
      </div>

      {/* Modal Detalles de Venta */}
      {showDetalles && selectedVenta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                Detalles de Venta #{selectedVenta.id}
              </h2>
              <button
                onClick={() => {
                  setShowDetalles(false);
                  setSelectedVenta(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Info de la venta */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-semibold">
                    {new Date(selectedVenta.created_at).toLocaleString('es-MX')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-semibold">
                    {(selectedVenta as any).clientes?.nombre || 'Cliente general'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Método de Pago</p>
                  <p className="font-semibold capitalize">
                    {selectedVenta.metodo_pago}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-bold text-green-600 text-xl">
                    ${selectedVenta.total.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Items de la venta */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">
                  Productos Vendidos
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Producto
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Cantidad
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Precio Unit.
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detallesVenta?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm">
                            {item.productos?.nombre || 'Producto'}
                          </td>
                          <td className="px-4 py-3 text-sm">{item.cantidad}</td>
                          <td className="px-4 py-3 text-sm">
                            ${item.precio_unitario.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">
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
        </div>
      )}

      {/* Modal Confirmar Anulación */}
      {showAnularConfirm && ventaToAnular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Anular Venta</h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas anular la venta #{ventaToAnular.id}?
              Esta acción devolverá el stock de los productos y eliminará el
              registro de la venta.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAnularConfirm(false);
                  setVentaToAnular(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => anularVentaMutation.mutate(ventaToAnular.id)}
                disabled={anularVentaMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-5 h-5" />
                <span>
                  {anularVentaMutation.isPending ? 'Anulando...' : 'Anular Venta'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
