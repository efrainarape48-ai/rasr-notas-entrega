import {
  type Auth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';

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

export async function signInWithGooglePopup(
  auth: Auth,
  context: GoogleAuthContext
): Promise<UserCredential> {
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
