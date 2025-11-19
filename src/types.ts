export interface Product {
  id: number;
  nombre: string;
  categoria: string;
  precio_compra: number;
  precio_venta: number;
  stock_actual: number;
  stock_minimo: number;
  codigo_barras?: string;
  descripcion?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Venta {
  id: number;
  folio: string;
  cliente_id?: number;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: "efectivo" | "tarjeta" | "transferencia";
  status: "completada" | "cancelada";
  created_at: string;
  updated_at?: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  rfc?: string;
  credito_disponible: number;
  created_at?: string;
}

export interface VentaDetalle {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface DashboardMetrics {
  ventasHoy: number;
  ventasMes: number;
  stockBajo: number;
  clientesActivos: number;
}
