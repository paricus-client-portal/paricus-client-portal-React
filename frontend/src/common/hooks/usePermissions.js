import { useSelector } from 'react-redux';

/**
 * Hook personalizado para verificar permisos del usuario
 * @returns {object} - Objeto con funciones y datos de permisos
 */
export const usePermissions = () => {
  const permissions = useSelector((state) => state.auth.permissions || []);
  const user = useSelector((state) => state.auth.user);

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param {string} permission - Nombre del permiso
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  /**
   * Verifica si el usuario tiene TODOS los permisos especificados
   * @param {string[]} requiredPermissions - Array de permisos requeridos
   * @returns {boolean}
   */
  const hasAllPermissions = (requiredPermissions) => {
    return requiredPermissions.every((permission) =>
      permissions.includes(permission)
    );
  };

  /**
   * Verifica si el usuario tiene AL MENOS UNO de los permisos especificados
   * @param {string[]} requiredPermissions - Array de permisos
   * @returns {boolean}
   */
  const hasAnyPermission = (requiredPermissions) => {
    return requiredPermissions.some((permission) =>
      permissions.includes(permission)
    );
  };

  /**
   * Verifica si el usuario es BPO Admin (tiene todos los permisos de admin)
   * @returns {boolean}
   */
  const isBPOAdmin = () => {
    return hasPermission('admin_users') && hasPermission('admin_clients');
  };

  /**
   * Verifica si el usuario es Client Admin
   * @returns {boolean}
   */
  const isClientAdmin = () => {
    return hasPermission('view_invoices') && !isBPOAdmin();
  };

  return {
    permissions,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isBPOAdmin,
    isClientAdmin,
  };
};
