import React, { useEffect, useState, createContext, useContext } from 'react';
import Login from './pages/Login.jsx';
import CambiarPasswordObligatorio from './pages/CambiarPasswordObligatorio.jsx';
import Splash from './pages/Splash.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Categorias from './pages/Categorias.jsx';
import Proveedores from './pages/Proveedores.jsx';
import Inventario from './pages/Inventario.jsx';
import InventarioFisico from './pages/InventarioFisico.jsx';
import Ventas from './pages/Ventas.jsx';
import HistorialVentas from './pages/HistorialVentas.jsx';
import Credito from './pages/Credito.jsx';
import Clientes from './pages/Clientes.jsx';
import Devoluciones from './pages/Devoluciones.jsx';
import Gastos from './pages/Gastos.jsx';
import Promociones from './pages/Promociones.jsx';
import Reportes from './pages/Reportes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Perfil from './pages/Perfil.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Revision from './pages/Revision.jsx';
import Tutoriales from './pages/Tutoriales.jsx';
import AcercaDe from './pages/AcercaDe.jsx';
import CorteCajaModal from './components/CorteCajaModal.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { useNegocio } from './hooks/useNegocio.js';
import { TourProvider } from './tours/TourContext.jsx';
import TourOverlay from './tours/TourOverlay.jsx';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const ROL_PERMISOS = {
  admin: '*',
  vendedor: ['ventas', 'historial_ventas', 'clientes', 'credito', 'devoluciones', 'perfil', 'promociones', 'tutoriales', 'acerca_de'],
  almacen: ['inventario', 'inventario_fisico', 'categorias', 'proveedores', 'perfil', 'devoluciones', 'tutoriales', 'acerca_de'],
};

const NAV = [
  { key: 'index', label: 'Dashboard', icon: '▦' },
  { key: 'ventas', label: 'Punto de Venta', icon: '▢' },
  { key: 'historial_ventas', label: 'Historial de Ventas', icon: '≣' },
  { key: 'credito', label: 'Crédito y Abonos', icon: 'Ⓢ' },
  { key: 'clientes', label: 'Clientes', icon: '●' },
  { key: 'devoluciones', label: 'Devoluciones', icon: '↺' },
  { key: 'inventario', label: 'Inventario', icon: '▣' },
  { key: 'inventario_fisico', label: 'Inventario Físico', icon: '☑' },
  { key: 'categorias', label: 'Categorías', icon: '☷' },
  { key: 'proveedores', label: 'Proveedores', icon: '⚑' },
  { key: 'promociones', label: 'Promociones', icon: '★' },
  { key: 'gastos', label: 'Gastos', icon: '▤' },
  { key: 'reportes', label: 'Reportes', icon: '☷' },
  { key: 'usuarios', label: 'Usuarios', icon: '▥', adminOnly: true },
  { key: 'revision', label: 'Revisión de Actividad', icon: '⚖', adminOnly: true },
  { key: 'tutoriales', label: 'Tutoriales', icon: '◎' },
  { key: 'perfil', label: 'Mi Perfil', icon: '☺' },
  { key: 'configuracion', label: 'Configuración', icon: '⚙', adminOnly: true },
  { key: 'acerca_de', label: 'Acerca de', icon: 'ⓘ' },
];

const ROLES_CON_CORTE = ['admin', 'vendedor'];

function puedeVer(rol, key) {
  const permisos = ROL_PERMISOS[rol] || [];
  if (permisos === '*') return true;
  return permisos.includes(key);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('index');
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('pvp_theme') || 'dark');
  const [mostrarCorte, setMostrarCorte] = useState(false);
  const [splashActivo, setSplashActivo] = useState(true);
  const [splashSaliendo, setSplashSaliendo] = useState(false);
  const { negocio, guardarNegocio } = useNegocio();

  useEffect(() => {
    const salir = setTimeout(() => setSplashSaliendo(true), 2400);
    const quitar = setTimeout(() => setSplashActivo(false), 2900);
    return () => { clearTimeout(salir); clearTimeout(quitar); };
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('pvp_user');
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      if (!puedeVer(u.rol, 'index')) {
        setPage(NAV.find((n) => (!n.adminOnly || u.rol === 'admin') && puedeVer(u.rol, n.key))?.key || 'perfil');
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pvp_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const login = (u) => {
    setUser(u);
    sessionStorage.setItem('pvp_user', JSON.stringify(u));
    setPage(puedeVer(u.rol, 'index') ? 'index' : (NAV.find((n) => (!n.adminOnly || u.rol === 'admin') && puedeVer(u.rol, n.key))?.key || 'perfil'));
  };
  const logoutInmediato = () => {
    window.api.auth.logout().catch(() => {});
    setUser(null);
    sessionStorage.removeItem('pvp_user');
  };

  const solicitarLogout = () => {
    if (user && ROLES_CON_CORTE.includes(user.rol)) setMostrarCorte(true);
    else logoutInmediato();
  };

  if (!user) {
    return (
      <>
        <Login onLogin={login} negocio={negocio} />
        {splashActivo && <Splash negocio={negocio} saliendo={splashSaliendo} />}
      </>
    );
  }

  if (user.debe_cambiar_password) {
    return (
      <CambiarPasswordObligatorio
        user={user}
        onCambiada={() => {
          const actualizado = { ...user, debe_cambiar_password: 0 };
          setUser(actualizado);
          sessionStorage.setItem('pvp_user', JSON.stringify(actualizado));
        }}
        onCancelar={logoutInmediato}
      />
    );
  }

  const items = NAV.filter((n) => (!n.adminOnly || user.rol === 'admin') && puedeVer(user.rol, n.key));
  const goto = (key) => { if (puedeVer(user.rol, key) && (!NAV.find(n=>n.key===key)?.adminOnly || user.rol==='admin')) setPage(key); };

  return (
    <AuthContext.Provider value={{ user, logout: solicitarLogout, goto, negocio, guardarNegocio }}>
      <TourProvider goto={goto}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            {negocio.logo && <img src={negocio.logo} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', marginRight: 8, verticalAlign: 'middle' }} />}
            Punto<span>Venta</span> {negocio.nombre_negocio}
          </div>
          <nav className="sidebar-nav">
            {items.map((n) => (
              <button key={n.key} data-tour={`nav-${n.key}`} className={'nav-item' + (page === n.key ? ' active' : '')} onClick={() => setPage(n.key)}>
                <span style={{ width: 18, display: 'inline-block', textAlign: 'center' }}>{n.icon}</span> {n.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer" data-tour="sidebar-footer">
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{user.nombre}</div>
            <div className="tag-role">{user.rol}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={solicitarLogout}>Cerrar sesión</button>
          </div>
        </aside>
        <div className="main-area">
          <div className="topbar">
            <strong>{NAV.find((n) => n.key === page)?.label || ''}</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'right', lineHeight: 1.3 }} data-tour="topbar-datetime">
                <div style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize' }}>{now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString('es-MX')}</div>
              </div>
              <button
                data-tour="topbar-theme"
                className="btn btn-ghost btn-sm"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <button
                data-tour="topbar-fullscreen"
                className="btn btn-ghost btn-sm"
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? '⤡' : '⤢'}
              </button>
            </div>
          </div>
          <div className="content">
            <UpdateBanner />
            {page === 'index' && <Dashboard />}
            {page === 'ventas' && <Ventas />}
            {page === 'historial_ventas' && <HistorialVentas />}
            {page === 'credito' && <Credito />}
            {page === 'clientes' && <Clientes />}
            {page === 'devoluciones' && <Devoluciones />}
            {page === 'inventario' && <Inventario />}
            {page === 'inventario_fisico' && <InventarioFisico />}
            {page === 'categorias' && <Categorias />}
            {page === 'proveedores' && <Proveedores />}
            {page === 'promociones' && <Promociones />}
            {page === 'gastos' && <Gastos />}
            {page === 'reportes' && <Reportes />}
            {page === 'usuarios' && user.rol === 'admin' && <Usuarios />}
            {page === 'revision' && user.rol === 'admin' && <Revision />}
            {page === 'tutoriales' && <Tutoriales />}
            {page === 'perfil' && <Perfil />}
            {page === 'configuracion' && user.rol === 'admin' && <Configuracion />}
            {page === 'acerca_de' && <AcercaDe />}
          </div>
        </div>
      </div>
      {mostrarCorte && (
        <CorteCajaModal
          usuarioId={user.id}
          onCancel={() => setMostrarCorte(false)}
          onFinish={() => { setMostrarCorte(false); logoutInmediato(); }}
        />
      )}
      <TourOverlay />
      </TourProvider>
      {splashActivo && <Splash negocio={negocio} saliendo={splashSaliendo} />}
    </AuthContext.Provider>
  );
}
