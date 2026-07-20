import {
  type Auth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithCredential,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export type GoogleAuthContext = 'login' | 'register';

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function getAuthDebugContext(auth: Auth, context: GoogleAuthContext) {
  const location = typeof window !== 'undefined' ? window.location : undefined;

  return {
    context,
    hostname: location?.hostname,
    origin: location?.origin,
    authDomain: auth.app.options.authDomain,
    projectId: auth.app.options.projectId,
  };
}

/**
 * Login con Google.
 *
 * - En la app nativa de Android (Capacitor), Google bloquea el flujo de
 *   popup/redirect dentro de WebViews genéricos ("disallowed_useragent"),
 *   así que usamos el SDK nativo de Google Sign-In vía
 *   @capacitor-firebase/authentication y sincronizamos la sesión resultante
 *   con el SDK web de Firebase (mismo `auth` que usa el resto de la app).
 * - En el navegador (Vercel / desarrollo local), se mantiene exactamente
 *   el mismo flujo de siempre (signInWithPopup).
 */
export async function signInWithGooglePopup(
  auth: Auth,
  context: GoogleAuthContext
): Promise<UserCredential | void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;

      if (!idToken) {
        throw new Error('No se recibió el token de Google. Intenta de nuevo.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      return await signInWithCredential(auth, credential);
    } catch (error: any) {
      console.error('Google Auth nativo falló:', {
        code: error?.code,
        message: error?.message,
        ...getAuthDebugContext(auth, context),
      });
      throw error;
    }
  }

  const provider = createGoogleProvider();

  await setPersistence(auth, browserLocalPersistence);

  try {
    return await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error('Google Auth popup failed:', {
      code: error?.code,
      message: error?.message,
      customData: error?.customData,
      ...getAuthDebugContext(auth, context),
    });

    throw error;
  }
}
