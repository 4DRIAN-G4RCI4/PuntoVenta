# Credenciales iniciales — Punto Venta Poblano

## Primer inicio de sesión

Al instalar la app por primera vez, se crean automáticamente 3 cuentas de
ejemplo. **Todas tienen contraseña temporal** — la app no te deja usar nada
hasta que la cambies por una tuya (pantalla obligatoria en el primer login).

| Rol | Correo | Contraseña temporal |
|---|---|---|
| Administrador | `admin@tienda.com` | `admin123` |
| Vendedor | `vendedor@tienda.com` | `vendedor123` |
| Almacén | `almacen@tienda.com` | `almacen123` |

Ya **no aparecen** en la pantalla de login de la app (antes sí, cualquiera
que abriera el programa las veía) — quedan documentadas solo aquí, para quien
instala el sistema por primera vez.

## Cómo funciona el cambio obligatorio

1. Entras con el correo y la contraseña temporal de la tabla de arriba.
2. La app te bloquea con una pantalla de "Tu contraseña es temporal — cámbiala
   para continuar" — no puedes usar nada más hasta hacerlo.
3. Escribes tu nueva contraseña (mínimo 8 caracteres) y confirmas.
4. Ya no se te vuelve a pedir, a menos que el administrador te resetee la
   contraseña después (ver siguiente sección) o crees una cuenta nueva.

## Cuando el admin da de alta a un empleado o le resetea la contraseña

Cualquier contraseña que el administrador escriba para otra persona (al crear
su cuenta en Usuarios, o al resetear la contraseña de alguien que la olvidó)
**también queda temporal** — esa persona tiene que cambiarla ella misma la
próxima vez que entre. El administrador nunca necesita "avisarle su
contraseña definitiva" — solo le da algo temporal para que pueda entrar una
vez.

## Nota de seguridad

Si ya usaste alguna de estas 3 cuentas de ejemplo **antes** de esta
actualización (o sea, si `admin123`/`vendedor123`/`almacen123` ya estuvieron
activas en tu instalación), cámbialas manualmente en cuanto puedas — entra
como admin y en Usuarios resetea la contraseña de cada una (eso también las
vuelve a marcar como temporales, forzando el cambio en su siguiente login).
