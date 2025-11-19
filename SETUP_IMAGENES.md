# Guía de Configuración - Funcionalidad de Imágenes de Productos

## Pasos para habilitar la carga de imágenes

### 1. Agregar columna imagen_url a la tabla productos

En el editor SQL de Supabase, ejecuta:

```sql
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS imagen_url TEXT;
```

### 2. Crear bucket de almacenamiento

En Supabase Dashboard:

1. Ve a **Storage** en el menú lateral
2. Haz clic en **Create a new bucket**
3. Nombre: `productos-imagenes`
4. Marca como **Public bucket** (para que las imágenes sean accesibles)
5. Haz clic en **Create bucket**

### 3. Configurar políticas de acceso (Opcional - Más seguro)

Si prefieres configurar políticas específicas, ejecuta esto en el editor SQL:

```sql
-- Permitir lectura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'productos-imagenes');

-- Permitir subida a usuarios autenticados
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'productos-imagenes'
  AND auth.role() = 'authenticated'
);

-- Permitir actualización a usuarios autenticados
CREATE POLICY "Users can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'productos-imagenes'
  AND auth.role() = 'authenticated'
);

-- Permitir eliminación a usuarios autenticados
CREATE POLICY "Users can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'productos-imagenes'
  AND auth.role() = 'authenticated'
);
```

## Características implementadas

✅ **Carga de imágenes**: Campo de archivo en formulario de productos
✅ **Preview en tiempo real**: Vista previa antes de guardar
✅ **Validación**: Solo archivos de imagen, máximo 2MB
✅ **Almacenamiento**: Imágenes guardadas en Supabase Storage
✅ **Visualización**: Imágenes mostradas en:

- Tabla de productos
- Grid de productos en POS
- Vista previa en formulario de edición
  ✅ **Placeholder**: Icono de paquete cuando no hay imagen

## Uso

### Agregar producto con imagen:

1. Ir a **Productos** → **Agregar Producto**
2. Completar datos del producto
3. En **Imagen del Producto**, clic en **Elegir archivo**
4. Seleccionar imagen (JPG, PNG, GIF - max 2MB)
5. Ver preview de la imagen
6. Clic en **Guardar**

### Editar imagen de producto existente:

1. En lista de productos, clic en ícono de editar
2. Se muestra imagen actual (si existe)
3. Seleccionar nueva imagen si deseas cambiarla
4. Clic en **Guardar**

### Eliminar imagen:

1. En formulario de edición, clic en **X** sobre la imagen preview
2. Esto eliminará la referencia (no borra el archivo de Storage)

## Notas técnicas

- Formato de nombre: `{timestamp}-{random}.{ext}`
- Ruta de almacenamiento: `productos/{filename}`
- URL pública generada automáticamente
- El campo `imagen_url` es opcional
