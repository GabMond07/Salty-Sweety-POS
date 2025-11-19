// Tipos basados en BD.sql

export interface Categoria {
  id: number;
  created_at: string;
  nombre: string;
  descripcion?: string;
}

export interface Product {
  id: number;
  created_at: string;
  nombre: string;
  descripcion?: string;
  precio_venta: number;
  precio_costo: number;
  stock_actual: number;
  stock_minimo: number;
  sku?: string;
  categoria_id?: number;
  imagen_url?: string;
}

export interface Cliente {
  id: number;
  created_at: string;
  nombre: string;
  email?: string;
  telefono?: string;
  notas_cliente?: string;
}

export interface Venta {
  id: number;
  created_at: string;
  total: number;
  metodo_pago: string; // 'efectivo', 'tarjeta', etc.
  usuario_id?: string;
  cliente_id?: number;
}

export interface VentaItem {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
}

export interface Cotizacion {
  id: number;
  created_at: string;
  cliente_id: number;
  total: number;
  valida_hasta: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  usuario_id?: string;
}

export interface CotizacionItem {
  id: number;
  cotizacion_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
}

export interface Nota {
  id: number;
  created_at: string;
  titulo?: string;
  contenido: string;
  etiqueta: "recordatorio" | "urgente" | "general";
  usuario_id?: string;
}

export interface MovimientoInventario {
  id: number;
  created_at: string;
  producto_id: number;
  tipo_movimiento: "venta" | "ajuste" | "devolucion" | "compra_proveedor";
  cantidad: number;
  justificacion?: string;
  usuario_id?: string;
}

// Tipos para UI
export interface DashboardMetrics {
  ventasHoy: number;
  ventasMes: number;
  stockBajo: number;
  clientesActivos: number;
}

export interface CartItem {
  producto: Product;
  cantidad: number;
  subtotal: number;
}
