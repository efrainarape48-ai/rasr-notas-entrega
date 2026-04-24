# RASR Notas de Entrega

Aplicación web para la gestión de notas de entrega, clientes e inventario. Permite crear documentos profesionales en PDF, controlar productos, registrar clientes y mantener actualizado el stock automáticamente a partir de las notas generadas.

## Descripción

RASR Notas de Entrega es una aplicación diseñada para pequeños negocios, talleres, distribuidores y emprendimientos que necesitan emitir notas de entrega de forma rápida, organizada y profesional.

La aplicación permite gestionar clientes, productos, inventario y documentos de entrega desde una interfaz web responsive, con soporte para escritorio y dispositivos móviles.

## Características principales

- Autenticación de usuarios con Firebase.
- Inicio de sesión con correo y contraseña.
- Inicio de sesión con Google.
- Gestión de perfil de empresa.
- Configuración de logo, datos fiscales, teléfono, dirección y correo comercial.
- Gestión de clientes.
- Gestión de inventario.
- Creación, edición y eliminación de notas de entrega.
- Generación de PDF profesional.
- Compartir notas por WhatsApp cuando el navegador lo permite.
- Control automático de inventario.
- Soporte para cantidades decimales en pasos de 0.25.
- Interfaz responsive para escritorio y móvil.

## Módulos de la aplicación

### Panel

Vista general del sistema y acceso rápido a las funciones principales.

### Clientes

Permite registrar y administrar clientes con los siguientes datos:

- Nombre de empresa o cliente.
- RIF, NIF o identificación fiscal.
- Teléfono de contacto.
- Correo electrónico.
- Dirección fiscal.

### Inventario

Permite crear y administrar productos con:

- SKU.
- Nombre o descripción del producto.
- Categoría.
- Precio unitario.
- Stock.
- Unidad de medida.
- Estado activo/inactivo.

El inventario soporta cantidades decimales, por ejemplo:

- 0.25
- 0.50
- 0.75
- 1.25
- 1.50
- 1.75

### Notas de entrega

Permite crear documentos de entrega asociados a un cliente y productos del inventario.

Cada nota puede incluir:

- Número de nota.
- Fecha de emisión.
- Cliente.
- Productos.
- Cantidades.
- Precio unitario.
- Total por línea.
- Subtotal.
- Total.
- Estado de la nota.

### PDF profesional

La aplicación genera un PDF con:

- Logo de la empresa.
- Nombre comercial.
- Dirección fiscal.
- Teléfono.
- Correo comercial opcional.
- Identificación fiscal.
- Datos del cliente.
- Tabla de productos.
- Cantidades.
- Precios.
- Totales.
- Pie de página personalizado.

Si el correo comercial de la empresa se deja vacío, no se muestra en el PDF.

## Control de inventario

El sistema ajusta automáticamente el inventario cuando se crean, editan o eliminan notas de entrega.

Ejemplo:

Si un producto tiene stock de `20` y se crea una nota con cantidad `1.75`, el inventario queda en:

```text
20 - 1.75 = 18.25
