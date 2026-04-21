import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  ChevronRight, 
  Printer, 
  Trash2, 
  Edit2, 
  Menu, 
  X,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  MessageCircle,
  User as UserIcon,
  Lock,
  Mail,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { auth } from './firebase';
import * as firestoreService from './services/firestoreService';
import { saveProfessionalPDF, getProfessionalPDFBlob } from './services/pdfService';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  Customer, 
  Item, 
  DeliveryNote, 
  Screen, 
  DeliveryStatus,
  DeliveryNoteLine,
  CompanyProfile,
  AppSettings,
  UserProfile
} from './types';

// --- Components ---

const normalizeDeliveryStatus = (status?: string): DeliveryStatus => {
  if (status === 'delivered' || status === 'issued') return 'delivered';
  if (status === 'canceled' || status === 'cancelled') return 'canceled';
  return 'draft';
};

const Badge = ({ status }: { status: DeliveryStatus | string }) => {
  const normalizedStatus = normalizeDeliveryStatus(status);

  const styles: Record<DeliveryStatus, string> = {
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    draft: 'bg-amber-100 text-amber-800 border-amber-200',
    canceled: 'bg-sky-100 text-sky-800 border-sky-200',
  };
  
  const labels: Record<DeliveryStatus, string> = {
    delivered: 'Entregado',
    draft: 'Borrador',
    canceled: 'Cancelado',
  };

  const icons: Record<DeliveryStatus, React.ReactNode> = {
    delivered: <CheckCircle2 size={14} className="mr-1.5" />,
    draft: <Clock size={14} className="mr-1.5" />,
    canceled: <AlertCircle size={14} className="mr-1.5" />,
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border tracking-widest uppercase ${styles[normalizedStatus]}`}>
      {icons[normalizedStatus]}
      {labels[normalizedStatus]}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`premium-card w-full ${maxWidth} p-6 space-y-4 max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="py-2">{children}</div>
      </motion.div>
    </div>
  );
};

interface ImportRow {
  sku: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  precio_unitario: string | number;
  stock: string | number;
  categoria: string;
  activo: string | boolean;
  error?: string;
}

const InventoryImportModal = ({ 
  isOpen, 
  onClose, 
  onImport,
  userUid
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onImport: (items: Item[]) => void;
  userUid?: string;
}) => {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const processedRows: ImportRow[] = jsonData.map((item: any) => {
          const row: ImportRow = {
            sku: String(item.sku || ''),
            nombre: String(item.nombre || ''),
            descripcion: String(item.descripcion || ''),
            unidad: String(item.unidad || 'unidad'),
            precio_unitario: item.precio_unitario || 0,
            stock: item.stock || 0,
            categoria: String(item.categoria || 'General'),
            activo: item.activo === undefined ? true : (String(item.activo).toLowerCase() === 'true' || item.activo === 1),
          };

          if (!row.nombre) row.error = 'El nombre es obligatorio';
          else if (isNaN(Number(row.precio_unitario))) row.error = 'Precio inválido';
          else if (isNaN(Number(row.stock))) row.error = 'Stock inválido';

          return row;
        });

        setRows(processedRows);
      } catch (err) {
        console.error('Error parsing file:', err);
        alert('Error al procesar el archivo. Asegúrate de usar el formato correcto.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validRows = rows.filter(r => !r.error);

  const handleConfirmImport = async () => {
    const newItems: Item[] = validRows.map(row => ({
      id: Math.random().toString(36).substr(2, 9),
      sku: row.sku,
      name: row.nombre,
      description: row.descripcion,
      price: Number(row.precio_unitario),
      unit: row.unidad,
      stock: Number(row.stock),
      categoria: row.categoria,
      activo: Boolean(row.activo),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    
    try {
      if (userUid) {
        await firestoreService.saveItemsBatch(userUid, newItems);
      }
      onImport(newItems);
      onClose();
      setRows([]);
    } catch (error) {
      console.error('Error importing items:', error);
      alert('Error al importar productos a la base de datos.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar Inventario" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent transition-colors cursor-pointer relative">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="mx-auto text-accent mb-4" size={32} />
          <p className="text-sm font-medium text-primary">Haz clic o arrastra un archivo Excel/CSV</p>
          <p className="text-xs text-muted mt-1">Formatos soportados: .xlsx, .xls, .csv</p>
        </div>

        {isProcessing && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
            <p className="text-xs text-muted mt-2">Procesando archivo...</p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Vista Previa ({rows.length} filas)</h4>
              <p className="text-xs text-muted">
                <span className="text-emerald-600 font-bold">{validRows.length} válidas</span> / 
                <span className="text-rose-600 font-bold"> {rows.length - validRows.length} con errores</span>
              </p>
            </div>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Precio</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className={row.error ? 'bg-rose-50' : ''}>
                      <td className="px-4 py-3 font-mono">{row.sku}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.nombre}</div>
                        {row.error && <div className="text-[10px] text-rose-600 font-bold">{row.error}</div>}
                      </td>
                      <td className="px-4 py-3">${Number(row.precio_unitario).toFixed(2)}</td>
                      <td className="px-4 py-3">{row.stock}</td>
                      <td className="px-4 py-3">
                        {row.error ? (
                          <AlertTriangle size={14} className="text-rose-600" />
                        ) : (
                          <CheckCircle2 size={14} className="text-emerald-600" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <div className="p-3 text-center text-[10px] text-muted border-t border-border">
                  Y {rows.length - 10} filas más...
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRows([])} className="premium-button-secondary text-xs">Cancelar</button>
              <button 
                onClick={handleConfirmImport} 
                disabled={validRows.length === 0}
                className="premium-button-primary text-xs"
              >
                Importar {validRows.length} productos
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const ShareFallbackModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compartir Nota de Entrega">
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-xl flex gap-3">
          <Info className="text-blue-600 shrink-0" size={20} />
          <p className="text-xs text-blue-800 leading-relaxed">
            Tu navegador no soporta el envío directo de archivos. Para compartir por WhatsApp, sigue estos pasos:
          </p>
        </div>
        <ol className="space-y-4 text-xs text-primary">
          <li className="flex gap-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white font-bold shrink-0">1</span>
            <span>Descarga el PDF de la nota de entrega a tu dispositivo.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white font-bold shrink-0">2</span>
            <span>Abre el chat de WhatsApp del cliente.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white font-bold shrink-0">3</span>
            <span>Adjunta el archivo PDF descargado manualmente.</span>
          </li>
        </ol>
        <div className="pt-4 flex flex-col gap-3">
          <button 
            onClick={onClose}
            className="premium-button-primary w-full flex items-center justify-center gap-2"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
};

const LogoUpload = ({ logoData, onUpload }: { logoData?: string; onUpload: (data: string) => void }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert('Formato no soportado. Usa PNG, JPG o SVG.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDim = 400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = file.type === 'image/svg+xml' 
          ? event.target?.result as string 
          : canvas.toDataURL('image/jpeg', 0.7);
        
        onUpload(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-6">
      <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-background relative group">
        {logoData ? (
          <img src={logoData} alt="Logo" className="w-full h-full object-contain" />
        ) : (
          <Package size={32} className="text-muted/30" />
        )}
        <input 
          type="file" 
          accept=".png,.jpg,.jpeg,.svg" 
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Upload size={20} className="text-white" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-primary uppercase tracking-widest">Logo de Empresa</p>
        <p className="text-[10px] text-muted leading-relaxed max-w-[200px]">
          Sube tu logo en formato PNG, JPG o SVG. Se optimizará automáticamente.
        </p>
        {logoData && (
          <button 
            onClick={() => onUpload('')}
            className="text-[10px] text-rose-600 font-bold uppercase tracking-widest hover:underline"
          >
            Eliminar Logo
          </button>
        )}
      </div>
    </div>
  );
};

// --- Helper Functions ---

const downloadExcelTemplate = () => {
  const headers = [['sku', 'nombre', 'descripcion', 'unidad', 'precio_unitario', 'stock', 'categoria', 'activo']];
  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
  XLSX.writeFile(wb, "plantilla_inventario_RASR.xlsx");
};

const getReadableErrorMessage = (error: any) => {
  const code = error?.code || '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Este método de inicio de sesión no está habilitado en Firebase.';
    case 'auth/popup-closed-by-user':
      return 'Cerraste la ventana de Google antes de completar el inicio de sesión.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente de Google.';
    case 'auth/cancelled-popup-request':
      return 'Se canceló el intento de inicio de sesión con Google.';
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado para iniciar sesión con Google en Firebase.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con este correo usando otro método de inicio de sesión.';
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado.';
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil.';
    case 'auth/user-disabled':
      return 'Esta cuenta fue deshabilitada.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenciales inválidas. Verifica tu correo y contraseña.';
    case 'permission-denied':
      return 'Firestore está bloqueando la lectura o escritura. Revisa las reglas de seguridad.';
    case 'unavailable':
      return 'Firestore no está disponible en este momento. Intenta de nuevo.';
    default:
      return code ? `Error: ${code}` : 'Ocurrió un error inesperado. Intenta de nuevo.';
  }
};

const shareOnWhatsApp = async (
  note: DeliveryNote,
  company: CompanyProfile,
  setIsSharing: (v: boolean) => void,
  openFallback?: () => void,
  customer?: Customer | null
) => {
  setIsSharing(true);
  try {
    const blob = getProfessionalPDFBlob(note, company, customer);
    const fileName = `${note.noteNumber}_${note.customerName.replace(/\s+/g, '_')}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Nota de Entrega ${note.noteNumber}`,
        text: `Hola, adjunto la nota de entrega ${note.noteNumber} de ${company.name}.`
      });
    } else {
      const text = encodeURIComponent(`Hola, adjunto la nota de entrega ${note.noteNumber} de ${company.name}. Por favor, descarga el PDF adjunto.`);
      window.open(`https://wa.me/${note.customerPhone.replace(/\D/g, '')}?text=${text}`, '_blank');
      saveProfessionalPDF(note, company, customer);
      openFallback?.();
    }
  } catch (error) {
    console.error('Error sharing:', error);
    alert('No se pudo compartir la nota por WhatsApp. Intenta descargar el PDF manualmente.');
  } finally {
    setIsSharing(false);
  }
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  notifications: true,
  autoPdf: false,
  currency: 'MXN',
  numberingFormat: 'NE-{YYYY}-{0000}',
  language: 'es'
};

const generateNoteNumber = (format: string, count: number) => {
  const year = String(new Date().getFullYear());
  const sequence = String(count + 1).padStart(4, '0');

  return (format || DEFAULT_SETTINGS.numberingFormat)
    .replace('{YYYY}', year)
    .replace('{0000}', sequence);
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRegistration, setPendingRegistration] = useState<{ name: string; email: string; password: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null);
  const [viewingNote, setViewingNote] = useState<DeliveryNote | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShareFallbackOpen, setIsShareFallbackOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    let unsubCustomers: (() => void) | undefined;
    let unsubItems: (() => void) | undefined;
    let unsubNotes: (() => void) | undefined;

    const cleanupSubscriptions = () => {
      if (unsubCustomers) {
        unsubCustomers();
        unsubCustomers = undefined;
      }
      if (unsubItems) {
        unsubItems();
        unsubItems = undefined;
      }
      if (unsubNotes) {
        unsubNotes();
        unsubNotes = undefined;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupSubscriptions();

      if (firebaseUser) {
        setIsLoading(true);

        try {
          const [profile, appSettings] = await Promise.all([
            firestoreService.getCompanyProfile(firebaseUser.uid),
            firestoreService.getAppSettings(firebaseUser.uid),
          ]);

          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined,
            company: profile || undefined,
          });

          setSettings(appSettings || DEFAULT_SETTINGS);

          unsubCustomers = firestoreService.subscribeToCustomers(
            firebaseUser.uid,
            setCustomers
          );
          unsubItems = firestoreService.subscribeToItems(
            firebaseUser.uid,
            setItems
          );
          unsubNotes = firestoreService.subscribeToDeliveryNotes(
            firebaseUser.uid,
            setDeliveryNotes
          );

          setCurrentScreen((prev) => {
            if (profile) {
              if (
                prev === 'login' ||
                prev === 'register' ||
                prev === 'register-company'
              ) {
                return 'dashboard';
              }
              return prev;
            }

            return 'register-company';
          });
        } catch (error: any) {
          console.error('Error loading user data:', error);
          setSettings(DEFAULT_SETTINGS);
          setCurrentScreen('register-company');
        } finally {
          setIsLoading(false);
        }
      } else {
        setUser(null);
        setSettings(DEFAULT_SETTINGS);
        setCustomers([]);
        setItems([]);
        setDeliveryNotes([]);
        setPendingRegistration(null);
        setCurrentScreen('login');
        setIsLoading(false);
      }
    });

    return () => {
      cleanupSubscriptions();
      unsubscribe();
    };
  }, []);

  const navigate = (screen: Screen) => {
    setCurrentScreen(screen);
    setIsSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const renderSidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="p-8 flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <FileText className="text-white" size={24} />
          </div>
          <span className="text-2xl font-bold tracking-tighter uppercase truncate max-w-[150px]">
            {user?.company?.name || 'RASR'}
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Panel' },
            { id: 'delivery-notes', icon: FileText, label: 'Notas de Entrega' },
            { id: 'customers', icon: Users, label: 'Clientes' },
            { id: 'items', icon: Package, label: 'Inventario' },
            { id: 'settings', icon: Settings, label: 'Configuración' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id as Screen)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all ${currentScreen === item.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-blue-gray/60 hover:bg-white/5 hover:text-white'}`}
            >
              <item.icon size={20} />
              <span className={`text-sm ${currentScreen === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-carbon/20">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/30">
              {user?.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-white truncate">{user?.displayName || 'Usuario'}</span>
              <span className="text-[10px] text-blue-gray/50 truncate">{user?.email}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-blue-gray/60 hover:bg-rose-500/10 hover:text-rose-500 transition-all font-bold text-xs uppercase tracking-widest"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderTopBar = (title: string, showBack = false, backTo: Screen = 'dashboard') => (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border lg:ml-64 no-print">
      <div className="flex items-center justify-between px-6 h-20 lg:px-10">
        <div className="flex items-center">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-carbon lg:hidden"
          >
            <Menu size={24} />
          </button>
          
          {showBack && (
            <button 
              onClick={() => navigate(backTo)}
              className="p-2 -ml-2 mr-3 text-carbon hover:bg-background rounded-full transition-colors"
            >
              <ArrowLeft size={22} />
            </button>
          )}

          <h1 className="text-xl font-extrabold text-carbon ml-2 lg:ml-0 uppercase tracking-tight">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest">{user?.company?.name}</span>
          </div>
          {user?.company?.logoData ? (
            <img src={user.company.logoData} alt="Logo" className="w-10 h-10 rounded-lg object-contain border border-border p-1 bg-white" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary font-bold text-sm border border-border">
              {user?.company?.name?.[0] || 'R'}
            </div>
          )}
        </div>
      </div>
    </header>
  );

  const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsSubmitting(true);
      
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (err: any) {
        console.error('Login error:', err);
        setError(getReadableErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleGoogleLogin = async () => {
      setError(null);
      setPendingRegistration(null);
      setIsSubmitting(true);
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        console.error('Google login error:', err);
        setError(getReadableErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-navy rounded-2xl shadow-2xl mb-6">
              <FileText className="text-primary" size={40} />
            </div>
            <h1 className="text-4xl font-extrabold text-carbon tracking-tighter uppercase">RASR</h1>
            <p className="text-steel mt-3 font-medium">Gestión de entregas profesional</p>
          </div>

          <div className="premium-card p-10">
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em] mb-2">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input 
                    type="email" 
                    required 
                    className="premium-input pl-12" 
                    placeholder="ejemplo@correo.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em] mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input 
                    type="password" 
                    required 
                    className="premium-input pl-12" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="premium-button-primary w-full py-4 text-xs uppercase tracking-[0.2em] font-extrabold disabled:opacity-50"
              >
                {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                  <span className="bg-background px-4 text-muted">O continuar con</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="premium-button-secondary w-full py-4 text-xs uppercase tracking-[0.2em] font-extrabold flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-steel">
                ¿No tienes una cuenta? <button onClick={() => navigate('register')} className="text-primary font-bold hover:underline">Regístrate ahora</button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const RegisterScreen = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleRegisterSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      setPendingRegistration({ name: name.trim(), email: email.trim(), password });
      navigate('register-company');
    };

    const handleGoogleRegister = async () => {
      setError(null);
      setPendingRegistration(null);
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        console.error('Google registration error:', err);
        setError(getReadableErrorMessage(err));
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-navy rounded-2xl shadow-2xl mb-6">
              <UserIcon className="text-primary" size={40} />
            </div>
            <h1 className="text-4xl font-extrabold text-carbon tracking-tighter uppercase">Registro</h1>
            <p className="text-steel mt-3 font-medium">Crea tu cuenta de usuario</p>
          </div>

          <div className="premium-card p-10">
            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em] mb-2">Nombre Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input 
                    type="text" 
                    required 
                    className="premium-input pl-12" 
                    placeholder="Tu nombre" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em] mb-2">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input 
                    type="email" 
                    required 
                    className="premium-input pl-12" 
                    placeholder="ejemplo@correo.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em] mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input 
                    type="password" 
                    required 
                    className="premium-input pl-12" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="premium-button-primary w-full py-4 text-xs uppercase tracking-[0.2em] font-extrabold">
                Siguiente: Datos del Negocio
              </button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                  <span className="bg-background px-4 text-muted">O regístrate con</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleRegister}
                className="premium-button-secondary w-full py-4 text-xs uppercase tracking-[0.2em] font-extrabold flex items-center justify-center gap-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-steel">
                ¿Ya tienes una cuenta? <button onClick={() => navigate('login')} className="text-primary font-bold hover:underline">Inicia sesión</button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const RegisterCompanyScreen = () => {
    const [companyName, setCompanyName] = useState('');
    const [taxId, setTaxId] = useState('');
    const [phone, setPhone] = useState('');
    const [businessEmail, setBusinessEmail] = useState(pendingRegistration?.email || auth.currentUser?.email || '');
    const [address, setAddress] = useState('');
    const [footerText, setFooterText] = useState('');
    const [logoData, setLogoData] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
      const currentAuthUser = auth.currentUser;

      if (!pendingRegistration && !currentAuthUser) {
        navigate('register');
        return;
      }

      if (currentAuthUser && !businessEmail) {
        setBusinessEmail(currentAuthUser.email || '');
      }
    }, [pendingRegistration, businessEmail]);

    const handleCompanySubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      const currentAuthUser = auth.currentUser;
      const isGoogleFlow = !!currentAuthUser && !pendingRegistration;

      if (!pendingRegistration && !isGoogleFlow) return;
      
      setError(null);
      setIsSubmitting(true);

      try {
        let firebaseUser = currentAuthUser;

        if (!firebaseUser && pendingRegistration) {
          const userCredential = await createUserWithEmailAndPassword(
            auth, 
            pendingRegistration.email.trim(), 
            pendingRegistration.password
          );
          firebaseUser = userCredential.user;

          await updateProfile(firebaseUser, {
            displayName: pendingRegistration.name.trim()
          });
        }

        if (!firebaseUser) {
          throw new Error('No se pudo obtener el usuario autenticado.');
        }

        const companyProfile: CompanyProfile = {
          name: companyName.trim(),
          taxId: taxId.trim(),
          phone: phone.trim(),
          address: address.trim(),
          email: (businessEmail || firebaseUser.email || pendingRegistration?.email || '').trim(),
          footerText: footerText.trim() || undefined,
          logoData
        };

        await Promise.all([
          firestoreService.saveCompanyProfile(firebaseUser.uid, companyProfile),
          firestoreService.saveAppSettings(firebaseUser.uid, settings)
        ]);

        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || pendingRegistration?.name || '',
          email: firebaseUser.email || pendingRegistration?.email || '',
          photoURL: firebaseUser.photoURL || undefined,
          company: companyProfile
        });

        setPendingRegistration(null);
        setCurrentScreen('dashboard');
      } catch (err: any) {
        console.error('Registration error:', err);
        setError(getReadableErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-navy rounded-2xl shadow-2xl mb-6">
              <Briefcase className="text-primary" size={40} />
            </div>
            <h1 className="text-4xl font-extrabold text-carbon tracking-tighter uppercase">Datos del Negocio</h1>
            <p className="text-steel mt-3 font-medium">Configura la información de tu empresa</p>
          </div>

          <div className="premium-card p-10">
            <form onSubmit={handleCompanySubmit} className="space-y-8">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">Nombre Comercial</label>
                  <input 
                    type="text" 
                    required 
                    className="premium-input" 
                    placeholder="Ej: Mi Empresa S.L." 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">CIF / NIF / Tax ID</label>
                  <input 
                    type="text" 
                    required 
                    className="premium-input" 
                    placeholder="Ej: B12345678" 
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">Teléfono de Contacto</label>
                  <input 
                    type="tel" 
                    required 
                    className="premium-input" 
                    placeholder="+34 000 000 000" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">Email del Negocio (Opcional)</label>
                  <input 
                    type="email" 
                    className="premium-input" 
                    placeholder="negocio@ejemplo.com" 
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">Logo de la Empresa</label>
                  <LogoUpload logoData={logoData} onUpload={setLogoData} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">Dirección Fiscal Completa</label>
                  <textarea 
                    required 
                    className="premium-input min-h-[100px]" 
                    placeholder="Calle, Número, Ciudad, CP, País" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-[10px] font-bold text-carbon uppercase tracking-[0.2em]">Texto de Pie de Página (Opcional)</label>
                  <textarea 
                    className="premium-input min-h-[60px]" 
                    placeholder="Ej: Gracias por su confianza. Términos y condiciones aplicables..." 
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    if (pendingRegistration) {
                      navigate('register');
                    } else {
                      handleLogout();
                    }
                  }}
                  className="flex-1 premium-button-secondary py-4 text-xs uppercase tracking-widest font-bold"
                >
                  {pendingRegistration ? 'Atrás' : 'Cancelar'}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-[2] premium-button-primary py-4 text-xs uppercase tracking-widest font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Creando Cuenta...' : 'Finalizar Registro'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  };

  const DashboardScreen = () => {
    const stats = [
      { label: 'Total Notas', value: deliveryNotes.length, icon: FileText, color: 'bg-primary' },
      { label: 'Clientes', value: customers.length, icon: Users, color: 'bg-accent' },
      { label: 'Productos', value: items.length, icon: Package, color: 'bg-primary' },
      { label: 'Entregados', value: deliveryNotes.filter(n => n.status === 'delivered').length, icon: CheckCircle2, color: 'bg-emerald-600' },
    ];

    return (
      <div className="p-6 lg:p-10 space-y-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="premium-card p-6 flex flex-col justify-between min-h-[140px]"
            >
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-black/5`}>
                <stat.icon size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">Notas de Entrega Recientes</h2>
              <button onClick={() => navigate('delivery-notes')} className="text-sm text-accent font-bold hover:underline tracking-wide">Ver todas</button>
            </div>
            <div className="premium-card divide-y divide-border overflow-hidden">
              {deliveryNotes.length > 0 ? (
                deliveryNotes.slice(0, 5).map((note) => (
                  <div 
                    key={note.id} 
                    onClick={() => { setViewingNote(note); navigate('delivery-note-detail'); }}
                    className="p-5 flex items-center justify-between hover:bg-background cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center text-muted border border-border">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-primary">{note.noteNumber}</p>
                        <p className="text-xs text-muted font-medium">{note.customerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary mb-1">${note.total.toLocaleString()}</p>
                      <Badge status={note.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-muted">No hay notas de entrega recientes.</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-primary">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => { setEditingNote(null); navigate('delivery-note-form'); }} className="premium-button-primary flex items-center justify-center space-x-3 py-5">
                <Plus size={20} />
                <span className="uppercase tracking-widest text-xs font-bold">Nueva Nota de Entrega</span>
              </button>
              <button onClick={() => { setEditingCustomer(null); navigate('customer-form'); }} className="premium-button-secondary flex items-center justify-center space-x-3 py-5">
                <Users size={20} />
                <span className="uppercase tracking-widest text-xs font-bold">Agregar Cliente</span>
              </button>
              <button onClick={() => { setEditingItem(null); navigate('item-form'); }} className="premium-button-secondary flex items-center justify-center space-x-3 py-5">
                <Package size={20} />
                <span className="uppercase tracking-widest text-xs font-bold">Agregar Producto</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CustomersScreen = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="p-6 lg:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Buscar clientes por nombre o correo..." 
              className="premium-input pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => { setEditingCustomer(null); navigate('customer-form'); }} className="premium-button-accent flex items-center justify-center space-x-2">
            <Plus size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Nuevo Cliente</span>
          </button>
        </div>

        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest">Nombre / Empresa</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest hidden md:table-cell">Contacto</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest hidden lg:table-cell">Dirección</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length > 0 ? (
                  filtered.map((customer) => (
                    <tr key={customer.id} className="hover:bg-background transition-colors group">
                      <td className="px-6 py-5">
                        <div className="font-bold text-primary">{customer.name}</div>
                        <div className="text-xs text-muted md:hidden mt-1">{customer.email}</div>
                      </td>
                      <td className="px-6 py-5 hidden md:table-cell">
                        <div className="text-sm text-primary font-medium">{customer.email}</div>
                        <div className="text-xs text-muted mt-1">{customer.phone}</div>
                      </td>
                      <td className="px-6 py-5 hidden lg:table-cell max-w-xs truncate">
                        <div className="text-sm text-muted">{customer.address}</div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingCustomer(customer); navigate('customer-form'); }}
                            className="p-2.5 text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (user && window.confirm('¿Estás seguro de eliminar este cliente permanentemente?')) {
                                try {
                                  await firestoreService.deleteCustomer(user.uid, customer.id);
                                } catch (error) {
                                  console.error('Error deleting customer:', error);
                                  alert('Error al eliminar el cliente.');
                                }
                              }
                            }}
                            className="p-2.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-muted font-medium italic">
                      No se encontraron clientes que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const CustomerFormScreen = () => {
    const [formData, setFormData] = useState<Partial<Customer>>(editingCustomer || {
      name: '',
      email: '',
      phone: '',
      address: '',
      taxId: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      const now = new Date().toISOString();
      const customerData: Customer = {
        ...formData,
        id: editingCustomer?.id || Math.random().toString(36).substr(2, 9),
        createdAt: editingCustomer?.createdAt || now,
        updatedAt: now
      } as Customer;

      try {
        await firestoreService.saveCustomer(user.uid, customerData);
        navigate('customers');
      } catch (error) {
        console.error('Error saving customer:', error);
        alert('Error al guardar el cliente en la base de datos.');
      }
    };

    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="premium-card p-8 lg:p-12">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 gap-8">
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Nombre de la Empresa / Cliente</label>
                <input 
                  type="text" 
                  required 
                  className="premium-input" 
                  placeholder="Ej. Distribuidora Global S.A."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required 
                    className="premium-input" 
                    placeholder="cliente@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Teléfono de Contacto</label>
                  <input 
                    type="tel" 
                    required 
                    className="premium-input" 
                    placeholder="+52 ..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">RFC / Identificación Fiscal</label>
                <input 
                  type="text" 
                  className="premium-input" 
                  placeholder="Opcional"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Dirección Completa</label>
                <textarea 
                  rows={3} 
                  required 
                  className="premium-input" 
                  placeholder="Calle, Número, Colonia, Ciudad, Estado..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                ></textarea>
              </div>
            </div>
            <div className="flex items-center space-x-4 pt-6">
              <button type="submit" className="premium-button-primary flex-1 py-4 text-sm uppercase tracking-widest font-bold">
                {editingCustomer ? 'Actualizar Cliente' : 'Crear Cliente'}
              </button>
              <button type="button" onClick={() => navigate('customers')} className="premium-button-secondary py-4 px-10 text-sm uppercase tracking-widest font-bold">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ItemsScreen = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Item; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filtered = useMemo(() => {
      const result = items.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );

      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return result;
    }, [searchTerm, sortConfig, items]);

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const handleSort = (key: keyof Item) => {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    };

    return (
      <div className="p-6 lg:p-10 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por SKU, nombre o descripción..." 
              className="premium-input pl-12"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={downloadExcelTemplate}
              className="premium-button-secondary flex items-center justify-center space-x-2 text-xs py-3"
            >
              <FileSpreadsheet size={16} />
              <span className="uppercase tracking-widest font-bold">Plantilla Excel</span>
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="premium-button-secondary flex items-center justify-center space-x-2 text-xs py-3"
            >
              <Upload size={16} />
              <span className="uppercase tracking-widest font-bold">Importar</span>
            </button>
            <button onClick={() => { setEditingItem(null); navigate('item-form'); }} className="premium-button-accent flex items-center justify-center space-x-2 text-xs py-3">
              <Plus size={16} />
              <span className="uppercase tracking-widest font-bold">Nuevo Producto</span>
            </button>
          </div>
        </div>

        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th 
                    className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors"
                    onClick={() => handleSort('sku')}
                  >
                    SKU {sortConfig.key === 'sku' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest cursor-pointer hover:text-accent transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    Producto {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest hidden lg:table-cell">Categoría</th>
                  <th 
                    className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest text-right cursor-pointer hover:text-accent transition-colors"
                    onClick={() => handleSort('price')}
                  >
                    Precio {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest text-center cursor-pointer hover:text-accent transition-colors"
                    onClick={() => handleSort('stock')}
                  >
                    Stock {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.length > 0 ? (
                  paginated.map((item) => (
                    <tr key={item.id} className="hover:bg-background transition-colors group">
                      <td className="px-6 py-5 font-mono text-xs text-muted">{item.sku}</td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-primary">{item.name}</div>
                        {!item.activo && <span className="text-[9px] font-bold text-rose-600 uppercase tracking-tighter">Inactivo</span>}
                      </td>
                      <td className="px-6 py-5 hidden lg:table-cell">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-accent/5 text-accent rounded">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-primary">
                        ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className={`text-sm font-bold ${item.stock < 10 ? 'text-rose-600' : 'text-primary'}`}>
                          {item.stock}
                        </div>
                        <div className="text-[10px] text-muted uppercase tracking-widest">{item.unit}</div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingItem(item); navigate('item-form'); }}
                            className="p-2.5 text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (user && window.confirm('¿Estás seguro de eliminar este producto permanentemente?')) {
                                try {
                                  await firestoreService.deleteItem(user.uid, item.id);
                                } catch (error) {
                                  console.error('Error deleting item:', error);
                                  alert('Error al eliminar el producto.');
                                }
                              }
                            }}
                            className="p-2.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-muted font-medium italic">
                      No se encontraron productos en el inventario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-background border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted font-medium">
                Mostrando <span className="text-primary">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-primary">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> de <span className="text-primary">{filtered.length}</span> productos
              </p>
              <div className="flex items-center space-x-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-2 text-muted hover:text-primary disabled:opacity-30 transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="text-xs font-bold text-primary px-3 py-1 bg-surface border border-border rounded">
                  {currentPage} / {totalPages}
                </span>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-2 text-muted hover:text-primary disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ItemFormScreen = () => {
    const [formData, setFormData] = useState<Partial<Item>>(editingItem || {
      sku: '',
      name: '',
      description: '',
      price: 0,
      unit: 'unidad',
      stock: 0,
      categoria: 'General',
      activo: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;

      const now = new Date().toISOString();
      const itemData: Item = {
        ...formData,
        id: editingItem?.id || Math.random().toString(36).substr(2, 9),
        createdAt: editingItem?.createdAt || now,
        updatedAt: now
      } as Item;

      try {
        await firestoreService.saveItem(user.uid, itemData);
        navigate('items');
      } catch (error) {
        console.error('Error saving item:', error);
        alert('Error al guardar el producto en la base de datos.');
      }
    };

    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="premium-card p-8 lg:p-12">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">SKU / Código</label>
                  <input 
                    type="text" 
                    required 
                    className="premium-input" 
                    placeholder="Ej. HER-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Nombre del Producto</label>
                  <input 
                    type="text" 
                    required 
                    className="premium-input" 
                    placeholder="Ej. Taladro Percutor 20V"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Descripción Detallada</label>
                <textarea 
                  rows={3} 
                  className="premium-input" 
                  placeholder="Características, especificaciones, etc."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Categoría</label>
                <input 
                  type="text" 
                  className="premium-input" 
                  placeholder="Ej. Herramientas Eléctricas"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Precio Unitario ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="premium-input" 
                    placeholder="0.00"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Unidad</label>
                  <select 
                    className="premium-input"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kilogramo (kg)</option>
                    <option value="m">Metro (m)</option>
                    <option value="paquete">Paquete</option>
                    <option value="caja">Caja</option>
                    <option value="set">Set</option>
                    <option value="par">Par</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Stock Inicial</label>
                  <input 
                    type="number" 
                    required 
                    className="premium-input" 
                    value={formData.stock || 0}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-border text-accent focus:ring-accent/20"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    />
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Producto Activo</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4 pt-6">
              <button type="submit" className="premium-button-primary flex-1 py-4 text-sm uppercase tracking-widest font-bold">
                {editingItem ? 'Actualizar Producto' : 'Crear Producto'}
              </button>
              <button type="button" onClick={() => navigate('items')} className="premium-button-secondary py-4 px-10 text-sm uppercase tracking-widest font-bold">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const DeliveryNotesScreen = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const filtered = deliveryNotes.filter(n => 
      n.noteNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      n.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteClick = (id: string) => {
      setNoteToDelete(id);
      setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
      if (user && noteToDelete) {
        try {
          await firestoreService.deleteDeliveryNote(user.uid, noteToDelete);
          setIsDeleteModalOpen(false);
          setNoteToDelete(null);
        } catch (error) {
          console.error('Error deleting delivery note:', error);
          alert('Error al eliminar la nota de entrega.');
        }
      }
    };

    return (
      <div className="p-6 lg:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por número o cliente..." 
              className="premium-input pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => { setEditingNote(null); navigate('delivery-note-form'); }} className="premium-button-accent flex items-center justify-center space-x-2">
            <Plus size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Nueva Nota de Entrega</span>
          </button>
        </div>

        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest">Número</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest hidden md:table-cell">Fecha</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest hidden sm:table-cell">Total</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-5 text-[11px] font-bold text-muted uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length > 0 ? (
                  filtered.map((note) => (
                    <tr 
                      key={note.id} 
                      className="hover:bg-background transition-colors cursor-pointer group"
                      onClick={() => { setViewingNote(note); navigate('delivery-note-detail'); }}
                    >
                      <td className="px-6 py-5 font-bold text-primary">{note.noteNumber}</td>
                      <td className="px-6 py-5 text-sm text-primary">{note.customerName}</td>
                      <td className="px-6 py-5 text-sm text-muted hidden md:table-cell">{note.issueDate}</td>
                      <td className="px-6 py-5 text-sm font-bold text-primary hidden sm:table-cell">${note.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-5">
                        <Badge status={note.status} />
                      </td>
                      <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingNote(note); navigate('delivery-note-form'); }}
                            className="p-2.5 text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(note.id)}
                            className="p-2.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-muted font-medium italic">
                      No se encontraron notas de entrega.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal 
          isOpen={isDeleteModalOpen} 
          onClose={() => setIsDeleteModalOpen(false)} 
          title="Confirmar Eliminación"
        >
          <div className="space-y-6">
            <p className="text-muted text-sm leading-relaxed">
              ¿Estás seguro de que deseas eliminar esta nota de entrega? Esta acción no se puede deshacer y se perderán todos los datos asociados.
            </p>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={confirmDelete}
                className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
              >
                Eliminar Permanentemente
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-background text-primary border border-border py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  const DeliveryNoteFormScreen = () => {
    const [formData, setFormData] = useState<Partial<DeliveryNote>>(editingNote || {
      noteNumber: generateNoteNumber(settings.numberingFormat, deliveryNotes.length),
      issueDate: new Date().toISOString().split('T')[0],
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      lines: [],
      status: 'draft',
      notes: '',
      signerName: ''
    });

    const [selectedItemId, setSelectedItemId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const totals = useMemo(() => {
      const subtotal = (formData.lines || []).reduce((acc, item) => acc + item.total, 0);
      return { subtotal, total: subtotal };
    }, [formData.lines]);

    const addItem = () => {
      const item = items.find(i => i.id === selectedItemId);
      if (!item) return;

      const newLine: DeliveryNoteLine = {
        itemId: item.id,
        name: item.name,
        quantity: quantity,
        price: item.price,
        total: item.price * quantity
      };

      setFormData({
        ...formData,
        lines: [...(formData.lines || []), newLine]
      });
      setSelectedItemId('');
      setQuantity(1);
    };

    const removeItem = (index: number) => {
      const newLines = [...(formData.lines || [])];
      newLines.splice(index, 1);
      setFormData({ ...formData, lines: newLines });
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;

      const customer = customers.find(c => c.id === formData.customerId);
      const now = new Date().toISOString();
      const finalNote = {
        ...formData,
        customerName: customer?.name || '',
        customerPhone: customer?.phone || '',
        customerAddress: customer?.address || '',
        customerEmail: customer?.email || '',
        customerTaxId: customer?.taxId || '',
        ...totals,
        id: editingNote?.id || Math.random().toString(36).substr(2, 9),
        createdAt: editingNote?.createdAt || now,
        updatedAt: now
      } as DeliveryNote;

      try {
        await firestoreService.saveDeliveryNote(user.uid, finalNote);
        navigate('delivery-notes');
      } catch (error) {
        console.error('Error saving delivery note:', error);
        const message = error instanceof Error ? error.message : 'Error al guardar la nota de entrega.';
        alert(message);
      }
    };

    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="premium-card p-8 space-y-8">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Información General</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Número de Nota</label>
                    <input 
                      type="text" 
                      required 
                      className="premium-input" 
                      value={formData.noteNumber}
                      onChange={(e) => setFormData({ ...formData, noteNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Fecha de Emisión</label>
                    <input 
                      type="date" 
                      required 
                      className="premium-input" 
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Cliente</label>
                  <select 
                    required 
                    className="premium-input"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  >
                    <option value="">Seleccionar un cliente</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="premium-card p-8 space-y-8">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Partidas / Productos</h3>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <select 
                    className="premium-input flex-1"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                  >
                    <option value="">Seleccionar producto para agregar</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (${i.price.toLocaleString()})</option>)}
                  </select>
                  <div className="flex gap-4 sm:w-48">
                    <input 
                      type="number" 
                      min="1" 
                      className="premium-input w-24" 
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value))}
                    />
                    <button 
                      type="button" 
                      onClick={addItem}
                      disabled={!selectedItemId}
                      className="premium-button-accent flex-1 flex items-center justify-center disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-muted uppercase tracking-widest border-b border-border">
                        <th className="py-4">Producto</th>
                        <th className="py-4 text-right">Cant.</th>
                        <th className="py-4 text-right">Precio</th>
                        <th className="py-4 text-right">Total</th>
                        <th className="py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(formData.lines || []).map((item, idx) => (
                        <tr key={idx} className="group">
                          <td className="py-4 text-sm font-bold text-primary">{item.name}</td>
                          <td className="py-4 text-sm text-muted text-right">{item.quantity}</td>
                          <td className="py-4 text-sm text-muted text-right">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-4 text-sm font-bold text-primary text-right">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-4 text-right">
                            <button 
                              type="button" 
                              onClick={() => removeItem(idx)}
                              className="p-2 text-muted hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(formData.lines || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted text-sm italic">No se han agregado productos aún.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="premium-card p-8 space-y-6">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Resumen</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-muted font-medium">
                    <span>Subtotal</span>
                    <span>${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-primary pt-4 border-t border-border">
                    <span>Total</span>
                    <span>${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="premium-card p-8 space-y-6">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Estado y Notas</h3>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Estado</label>
                  <select 
                    className="premium-input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DeliveryStatus })}
                  >
                    <option value="draft">Borrador</option>
                    <option value="delivered">Entregado</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Nombre de Recibido</label>
                  <input 
                    type="text" 
                    className="premium-input"
                    value={formData.signerName}
                    onChange={(e) => setFormData({ ...formData, signerName: e.target.value })}
                    placeholder="Persona que recibe la entrega"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Notas Internas</label>
                  <textarea 
                    rows={3} 
                    className="premium-input"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observaciones adicionales..."
                  ></textarea>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button type="submit" className="premium-button-primary py-5 text-sm uppercase tracking-widest font-bold">
                  {editingNote ? 'Actualizar Nota' : 'Guardar Nota de Entrega'}
                </button>
                <button type="button" onClick={() => navigate('delivery-notes')} className="premium-button-secondary py-4 text-sm uppercase tracking-widest font-bold">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  };

  const DeliveryNoteDetailScreen = () => {
    if (!viewingNote) return null;
    const customer = customers.find(c => c.id === viewingNote.customerId);

    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between no-print">
          <button onClick={() => navigate('delivery-notes')} className="premium-button-secondary flex items-center space-x-2 py-2.5 px-4">
            <ArrowLeft size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Volver al Listado</span>
          </button>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => shareOnWhatsApp(viewingNote, user?.company || { name: 'RASR', phone: '', email: '', address: '', taxId: '' }, setIsSharing, () => setIsShareFallbackOpen(true), customer)} 
              disabled={isSharing}
              className="premium-button-secondary flex items-center space-x-2 py-2.5 px-4 border-accent/30 text-accent hover:bg-accent/5 disabled:opacity-50"
            >
              {isSharing ? <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={18} />}
              <span className="text-xs font-bold uppercase tracking-widest">{isSharing ? 'Generando...' : 'Compartir por WhatsApp'}</span>
            </button>
            <button 
              onClick={() => user?.company && saveProfessionalPDF(viewingNote, user.company, customer)} 
              className="premium-button-secondary flex items-center space-x-2 py-2.5 px-4"
            >
              <Printer size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Imprimir / PDF</span>
            </button>
            <button 
              onClick={() => { setEditingNote(viewingNote); navigate('delivery-note-form'); }}
              className="premium-button-primary flex items-center space-x-2 py-2.5 px-6"
            >
              <Edit2 size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Editar Nota</span>
            </button>
          </div>
        </div>

        <div id="delivery-note-pdf" className="premium-card p-12 lg:p-20 space-y-16 bg-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start gap-12 relative z-10">
            <div className="space-y-8">
              <div className="flex items-center space-x-4">
                {user?.company?.logoData ? (
                  <div className="w-20 h-20 flex items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2">
                    <img 
                      src={user.company.logoData} 
                      alt="Logo" 
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
                    <FileText className="text-accent" size={32} />
                  </div>
                )}
                <span className="text-3xl font-bold tracking-tight text-primary">{user?.company?.name || 'RASR'}</span>
              </div>
              <div className="space-y-2 text-muted text-sm leading-relaxed">
                <p className="font-bold text-primary text-base">{user?.company?.name || 'RASR'}</p>
                <p>{user?.company?.address || 'Sin dirección registrada'}</p>
                {user?.company?.taxId && <p className="pt-2 font-medium">CIF: {user.company.taxId}</p>}
              </div>
            </div>
            <div className="text-right space-y-4">
              <h2 className="text-5xl font-bold text-primary uppercase tracking-tight leading-none">Nota de Entrega</h2>
              <p className="text-2xl font-bold text-accent tracking-widest">{viewingNote.noteNumber}</p>
              <div className="space-y-2 text-sm pt-4">
                <p className="text-muted font-medium uppercase tracking-widest text-[10px]">Fecha de Emisión</p>
                <p className="text-primary font-bold text-lg">{viewingNote.issueDate}</p>
                <div className="pt-2 flex justify-end">
                  <Badge status={viewingNote.status} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-16 border-t border-border pt-16 relative z-10">
            <div className="space-y-6">
              <h4 className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] border-b border-border pb-3">Entregar a:</h4>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-primary">{viewingNote.customerName}</p>
                <p className="text-muted leading-relaxed">{viewingNote.customerAddress}</p>
                <p className="text-muted font-medium">{viewingNote.customerPhone}</p>
                {customer?.taxId && <p className="text-accent font-bold text-xs mt-4 tracking-widest uppercase">CIF/NIF: {customer.taxId}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-primary">
                  <th className="py-5 text-xs font-bold text-primary uppercase tracking-widest">Descripción del Producto</th>
                  <th className="py-5 text-xs font-bold text-primary uppercase tracking-widest text-right">Cantidad</th>
                  <th className="py-5 text-xs font-bold text-primary uppercase tracking-widest text-right">Precio Unit.</th>
                  <th className="py-5 text-xs font-bold text-primary uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {viewingNote.lines.map((item, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-6">
                      <p className="font-bold text-primary text-lg">{item.name}</p>
                    </td>
                    <td className="py-6 text-right text-muted font-medium">{item.quantity}</td>
                    <td className="py-6 text-right text-muted font-medium">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-6 text-right font-bold text-primary text-lg">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end pt-12 border-t border-border relative z-10">
            <div className="w-full sm:w-80 space-y-4">
              <div className="flex justify-between text-muted font-medium">
                <span className="uppercase tracking-widest text-[10px]">Subtotal</span>
                <span className="text-lg">${viewingNote.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-3xl font-bold text-primary pt-6 border-t-2 border-primary">
                <span className="uppercase tracking-widest text-xs self-center">Total Neto</span>
                <span>${viewingNote.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {viewingNote.notes && (
            <div className="bg-background/50 p-8 rounded-2xl border border-border relative z-10">
              <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">Observaciones:</h4>
              <p className="text-primary text-sm italic leading-relaxed">{viewingNote.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-20 pt-20 relative z-10">
            <div className="space-y-12">
              <div className="h-32 border-b border-border flex items-end justify-center pb-4"></div>
              <p className="text-center text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Firma Autorizada y Sello</p>
            </div>
            <div className="space-y-12">
              <div className="h-32 border-b border-border flex flex-col items-center justify-end pb-4">
                {viewingNote.signatureSvg && (
                  <div dangerouslySetInnerHTML={{ __html: viewingNote.signatureSvg }} className="w-full h-24 mb-2" />
                )}
                {viewingNote.signerName && <p className="text-sm font-bold text-primary">{viewingNote.signerName}</p>}
              </div>
              <p className="text-center text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Firma del Receptor</p>
            </div>
          </div>

          <div className="pt-20 space-y-8 border-t border-border">
            <div className="text-center">
              <p className="text-[10px] text-muted uppercase tracking-[0.3em] font-medium">
                {user?.company?.footerText || 'Gracias por su confianza.'}
              </p>
            </div>
            <div className="pt-8 border-t border-border/50 text-center">
              <p className="text-[9px] text-muted/60 leading-relaxed max-w-2xl mx-auto uppercase tracking-wider">
                Documento interno de nota de entrega. Sin derecho a crédito fiscal. Este documento no constituye factura fiscal y se emite únicamente como constancia de entrega de mercancía.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SettingsScreen = () => {
    const [companyData, setCompanyData] = useState<CompanyProfile>(user?.company || {
      name: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      footerText: ''
    });
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

    useEffect(() => {
      setCompanyData(user?.company || {
        name: '',
        phone: '',
        email: '',
        address: '',
        taxId: '',
        footerText: ''
      });
      setLocalSettings(settings);
    }, [user?.company, settings]);

    const handleSave = async () => {
      if (user) {
        try {
          await Promise.all([
            firestoreService.saveCompanyProfile(user.uid, companyData),
            firestoreService.saveAppSettings(user.uid, localSettings)
          ]);
          
          setUser({
            ...user,
            company: companyData
          });
          setSettings(localSettings);
          
          const btn = document.getElementById('save-settings-btn');
          if (btn) {
            const originalText = btn.innerText;
            btn.innerText = '¡Guardado!';
            setTimeout(() => { btn.innerText = originalText; }, 2000);
          }
        } catch (error) {
          console.error('Error saving settings:', error);
          alert('Error al guardar la configuración.');
        }
      }
    };

    const handleDiscard = () => {
      if (user?.company) {
        setCompanyData(user.company);
      }
      setLocalSettings(settings);
    };

    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-8">
        <div className="premium-card divide-y divide-border">
          <div className="p-8 space-y-8">
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Perfil de la Empresa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Nombre de la Empresa</label>
                <input 
                  type="text" 
                  className="premium-input" 
                  value={companyData.name} 
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">CIF / NIF</label>
                <input 
                  type="text" 
                  className="premium-input" 
                  value={companyData.taxId || ''} 
                  onChange={(e) => setCompanyData({ ...companyData, taxId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Teléfono de Contacto</label>
                <input 
                  type="text" 
                  className="premium-input" 
                  value={companyData.phone} 
                  onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Dirección Fiscal</label>
                <textarea 
                  rows={3} 
                  className="premium-input" 
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                ></textarea>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Personalización de Documentos</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Logo de la Empresa</label>
                <LogoUpload 
                  logoData={companyData.logoData} 
                  onUpload={(data) => setCompanyData({ ...companyData, logoData: data })} 
                />
                <p className="mt-2 text-[10px] text-muted uppercase tracking-wider">Se recomienda un fondo transparente y formato horizontal.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Texto de Pie de Página</label>
                <textarea 
                  rows={2} 
                  className="premium-input" 
                  placeholder="Gracias por su confianza. Términos y condiciones aplicables..."
                  value={companyData.footerText || ''}
                  onChange={(e) => setCompanyData({ ...companyData, footerText: e.target.value })}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-border pb-4">Preferencias de la Aplicación</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border">
                <div>
                  <p className="font-bold text-primary text-sm">Notificaciones por Email</p>
                  <p className="text-xs text-muted">Recibir alertas cuando se entreguen las notas</p>
                </div>
                <div 
                  onClick={() => setLocalSettings({ ...localSettings, notifications: !localSettings.notifications })}
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${localSettings.notifications ? 'bg-accent' : 'bg-border'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${localSettings.notifications ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border">
                <div>
                  <p className="font-bold text-primary text-sm">Generación Automática de PDF</p>
                  <p className="text-xs text-muted">Crear PDF inmediatamente después de guardar</p>
                </div>
                <div 
                  onClick={() => setLocalSettings({ ...localSettings, autoPdf: !localSettings.autoPdf })}
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${localSettings.autoPdf ? 'bg-accent' : 'bg-border'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${localSettings.autoPdf ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Moneda</label>
                  <select 
                    className="premium-input"
                    value={localSettings.currency}
                    onChange={(e) => setLocalSettings({ ...localSettings, currency: e.target.value })}
                  >
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dólar ($)</option>
                    <option value="MXN">Peso (MXN$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-3">Idioma</label>
                  <select 
                    className="premium-input"
                    value={localSettings.language}
                    onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value as 'es' | 'en' })}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="p-8 flex justify-end gap-4">
            <button 
              onClick={handleDiscard}
              className="premium-button-secondary py-3 px-8 text-xs font-bold uppercase tracking-widest"
            >
              Descartar
            </button>
            <button 
              id="save-settings-btn"
              onClick={handleSave}
              className="premium-button-primary py-3 px-8 text-xs font-bold uppercase tracking-widest"
            >
              Guardar Cambios
            </button>
          </div>
        </div>

        <div className="premium-card p-8 border-rose-100 bg-rose-50/30">
          <h3 className="text-xs font-bold text-rose-600 uppercase tracking-widest border-b border-rose-100 pb-4 mb-6">Zona de Peligro</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-rose-900 text-sm">Cerrar Sesión</p>
              <p className="text-xs text-rose-600/70">Salir de tu cuenta en este dispositivo</p>
            </div>
            <button onClick={handleLogout} className="bg-rose-600 text-white py-3 px-8 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-colors">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest">Cargando...</p>
        </div>
      </div>
    );
  }

  if (currentScreen === 'login') {
    return <LoginScreen />;
  }
  if (currentScreen === 'register') {
    return <RegisterScreen />;
  }
  if (currentScreen === 'register-company') {
    return <RegisterCompanyScreen />;
  }

  const getTitle = () => {
    switch (currentScreen) {
      case 'dashboard': return 'Panel de Control';
      case 'customers': return 'Clientes';
      case 'customer-form': return editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente';
      case 'items': return 'Inventario de Productos';
      case 'item-form': return editingItem ? 'Editar Producto' : 'Nuevo Producto';
      case 'delivery-notes': return 'Notas de Entrega';
      case 'delivery-note-form': return editingNote ? 'Editar Nota' : 'Nueva Nota de Entrega';
      case 'delivery-note-detail': return viewingNote?.noteNumber || 'Detalle de Nota';
      case 'settings': return 'Configuración';
      default: return user?.company?.name || 'RASR';
    }
  };

  const isForm = ['customer-form', 'item-form', 'delivery-note-form', 'delivery-note-detail'].includes(currentScreen);
  const backTo: Screen = currentScreen === 'customer-form' ? 'customers' : 
                        currentScreen === 'item-form' ? 'items' : 
                        currentScreen.includes('delivery-note') ? 'delivery-notes' : 'dashboard';

  return (
    <div className="min-h-screen bg-background">
      {renderSidebar()}
      
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {renderTopBar(getTitle(), isForm, backTo)}
        
        <main className="flex-1 pb-20 lg:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentScreen === 'dashboard' && <DashboardScreen />}
              {currentScreen === 'customers' && <CustomersScreen />}
              {currentScreen === 'customer-form' && <CustomerFormScreen />}
              {currentScreen === 'items' && <ItemsScreen />}
              {currentScreen === 'item-form' && <ItemFormScreen />}
              {currentScreen === 'delivery-notes' && <DeliveryNotesScreen />}
              {currentScreen === 'delivery-note-form' && <DeliveryNoteFormScreen />}
              {currentScreen === 'delivery-note-detail' && <DeliveryNoteDetailScreen />}
              {currentScreen === 'settings' && <SettingsScreen />}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-md border-t border-border px-4 h-20 flex items-center justify-around lg:hidden no-print z-40">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Inicio' },
            { id: 'delivery-notes', icon: FileText, label: 'Notas' },
            { id: 'customers', icon: Users, label: 'Clientes' },
            { id: 'items', icon: Package, label: 'Items' },
            { id: 'settings', icon: Settings, label: 'Ajustes' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id as Screen)}
              className={`flex flex-col items-center justify-center space-y-1.5 transition-all ${currentScreen === item.id ? 'text-accent' : 'text-muted hover:text-primary'}`}
            >
              <item.icon size={22} className={currentScreen === item.id ? 'scale-110' : ''} />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]">{item.label}</span>
            </button>
          ))}
        </nav>

        <ShareFallbackModal isOpen={isShareFallbackOpen} onClose={() => setIsShareFallbackOpen(false)} />
        <InventoryImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          userUid={user?.uid}
          onImport={() => {
            setIsImportModalOpen(false);
          }} 
        />
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}

export default App;
