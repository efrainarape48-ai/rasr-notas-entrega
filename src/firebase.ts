import { initializeApp } from "firebase/app";
import { getAuth, useDeviceLanguage } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBi1I4C5cR2kxYI8kPoHDszGaw0Kcd430k",
  authDomain: "rasr-app.firebaseapp.com",
  projectId: "rasr-app",
  storageBucket: "rasr-app.firebasestorage.app",
  messagingSenderId: "357810798765",
  appId: "1:357810798765:web:5b04f75739b11085c2c624",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
useDeviceLanguage(auth);

export const db = getFirestore(app);

export default app;
