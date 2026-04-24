# RASR Notas de Entrega

## Descripción

RASR Notas de Entrega es una solución digital diseñada para optimizar y modernizar la gestión de entregas en pequeñas y medianas empresas. El sistema permite la creación ágil de notas de entrega profesionales, la gestión centralizada de clientes y el control de inventario, todo bajo una interfaz intuitiva y de alto rendimiento.

## Stack tecnológico

- **Frontend:** React 19 + TypeScript
- **Estilos:** Tailwind CSS
- **Animaciones:** Motion
- **Iconos:** Lucide React
- **Utilidades:** 
  - `xlsx` para la gestión de datos en hojas de cálculo.
  - `jspdf` y `html2canvas` para la exportación de documentos a PDF.
- **Herramienta de construcción:** Vite

## Requisitos

- Node.js (versión 18 o superior)
- npm o yarn

## Instalación

Para configurar el proyecto localmente, ejecute los siguientes comandos:

```
git clone https://github.com/usuario/rasr-notas-entrega.git
cd rasr-notas-entrega
npm install
npm run dev
```

## Comandos disponibles

- `npm run dev`: Inicia el servidor de desarrollo en el puerto 3000.
- `npm run build`: Compila la aplicación para producción en la carpeta `dist`.
- `npm run preview`: Previsualiza localmente la versión de producción.
- `npm run clean`: Elimina los archivos generados en la carpeta de construcción.
- `npm run typecheck`: Realiza la validación de tipos con el compilador de TypeScript.

## Flujo principal de uso

1. **Configuración inicial:** El usuario registra su cuenta y completa el perfil de su empresa, incluyendo logotipo y datos fiscales.
2. **Inventario:** Carga de productos mediante entrada manual o importación masiva desde archivos Excel.
3. **Clientes:** Registro y administración de la base de datos de clientes.
4. **Documentación:** Creación de notas de entrega seleccionando clientes y productos, con cálculo automático de importes y captura de firma digital.
5. **Distribución:** Generación instantánea de archivos PDF y opciones para compartir vía WhatsApp.

## Estado actual del proyecto

El proyecto se encuentra actualmente en su fase de Producto Mínimo Viable (MVP). Todas las funcionalidades de la interfaz de usuario son operativas y el diseño es completamente responsivo.

## Nota

Prueba inicial de rama staging
