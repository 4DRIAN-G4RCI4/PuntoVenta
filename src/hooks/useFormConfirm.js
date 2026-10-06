import { useConfirm } from '../components/ConfirmProvider.jsx';

// Protege un modal de "agregar algo" contra un clic accidental afuera que
// borraría todo lo capturado — confirma antes de cerrar si hay datos escritos.
// Para EDITAR algo existente no hace falta (los datos siguen en la BD), así
// que esArticuloNuevo debe ser false ahí y nunca pregunta nada.
export function useFormConfirm({ esArticuloNuevo, tieneDatos, onClose, mensaje = 'Se perderá lo que llevas capturado.' }) {
  const { confirmar } = useConfirm();
  return async function cerrar() {
    if (esArticuloNuevo && tieneDatos() && !(await confirmar(mensaje, 'Cancelar'))) return false;
    onClose();
    return true;
  };
}
