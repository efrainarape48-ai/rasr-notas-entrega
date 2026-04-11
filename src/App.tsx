from pathlib import Path
import re

src = Path('/mnt/data/App.tsx').read_text(encoding='utf-8')

old_pattern = re.compile(
    r"""  // Auth Listener\s*useEffect\(\(\) => \{.*?\n  \}, \[currentScreen\]\);""",
    re.DOTALL
)

new_block = """  // Auth Listener
  useEffect(() => {
    let unsubCustomers: (() => void) | undefined;
    let unsubItems: (() => void) | undefined;
    let unsubNotes: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoading(true);

        // Temporal: dejamos entrar primero al usuario autenticado
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || undefined,
          company: undefined,
        });

        try {
          // Luego intentamos cargar perfil y configuración
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

          if (appSettings) {
            setSettings(appSettings);
          }

          // Suscripciones en tiempo real
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

          // Navegación
          if (
            currentScreen === 'login' ||
            currentScreen === 'register' ||
            currentScreen === 'register-company'
          ) {
            if (!profile) {
              setCurrentScreen('register-company');
            } else {
              setCurrentScreen('dashboard');
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);

          // Temporal: aunque falle Firestore, dejamos pasar al dashboard
          setCurrentScreen('dashboard');
        } finally {
          setIsLoading(false);
        }
      } else {
        setUser(null);
        setCustomers([]);
        setItems([]);
        setDeliveryNotes([]);

        if (
          currentScreen !== 'register' &&
          currentScreen !== 'register-company'
        ) {
          setCurrentScreen('login');
        }

        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubCustomers) unsubCustomers();
      if (unsubItems) unsubItems();
      if (unsubNotes) unsubNotes();
    };
  }, [currentScreen]);"""

new_src, count = old_pattern.subn(new_block, src, count=1)
if count != 1:
    raise RuntimeError("No se pudo localizar el bloque useEffect esperado para reemplazar.")

out = Path('/mnt/data/App_temporal_login_test.tsx')
out.write_text(new_src, encoding='utf-8')
print(f"Archivo generado: {out}")
print(f"Reemplazos realizados: {count}")
