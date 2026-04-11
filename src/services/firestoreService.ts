import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AppSettings,
  CompanyProfile,
  Customer,
  Item,
  DeliveryNote,
} from '../types';

const userDoc = (uid: string) => doc(db, 'users', uid);

const companyProfileDoc = (uid: string) =>
  doc(db, 'users', uid, 'profile', 'main');

const appSettingsDoc = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'app');

const customersCol = (uid: string) =>
  collection(db, 'users', uid, 'customers');

const itemsCol = (uid: string) =>
  collection(db, 'users', uid, 'items');

const deliveryNotesCol = (uid: string) =>
  collection(db, 'users', uid, 'deliveryNotes');

async function ensureUserRoot(uid: string) {
  await setDoc(
    userDoc(uid),
    {
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function getCompanyProfile(
  uid: string
): Promise<CompanyProfile | null> {
  const snap = await getDoc(companyProfileDoc(uid));
  return snap.exists() ? (snap.data() as CompanyProfile) : null;
}

export async function saveCompanyProfile(
  uid: string,
  profile: CompanyProfile
): Promise<void> {
  await ensureUserRoot(uid);
  await setDoc(
    companyProfileDoc(uid),
    {
      ...profile,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function getAppSettings(
  uid: string
): Promise<AppSettings | null> {
  const snap = await getDoc(appSettingsDoc(uid));
  return snap.exists() ? (snap.data() as AppSettings) : null;
}

export async function saveAppSettings(
  uid: string,
  settings: AppSettings
): Promise<void> {
  await ensureUserRoot(uid);
  await setDoc(
    appSettingsDoc(uid),
    {
      ...settings,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export function subscribeToCustomers(
  uid: string,
  callback: (rows: Customer[]) => void
): () => void {
  const q = query(customersCol(uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => d.data() as Customer);
    callback(rows);
  });
}

export function subscribeToItems(
  uid: string,
  callback: (rows: Item[]) => void
): () => void {
  const q = query(itemsCol(uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => d.data() as Item);
    callback(rows);
  });
}

export function subscribeToDeliveryNotes(
  uid: string,
  callback: (rows: DeliveryNote[]) => void
): () => void {
  const q = query(deliveryNotesCol(uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => d.data() as DeliveryNote);
    callback(rows);
  });
}

export async function saveCustomer(
  uid: string,
  customer: Customer
): Promise<void> {
  await ensureUserRoot(uid);
  await setDoc(doc(customersCol(uid), customer.id), customer, { merge: true });
}

export async function deleteCustomer(
  uid: string,
  customerId: string
): Promise<void> {
  await deleteDoc(doc(customersCol(uid), customerId));
}

export async function saveItem(uid: string, item: Item): Promise<void> {
  await ensureUserRoot(uid);
  await setDoc(doc(itemsCol(uid), item.id), item, { merge: true });
}

export async function saveItemsBatch(uid: string, items: Item[]): Promise<void> {
  await ensureUserRoot(uid);
  const batch = writeBatch(db);

  items.forEach((item) => {
    batch.set(doc(itemsCol(uid), item.id), item, { merge: true });
  });

  await batch.commit();
}

export async function deleteItem(
  uid: string,
  itemId: string
): Promise<void> {
  await deleteDoc(doc(itemsCol(uid), itemId));
}

export async function saveDeliveryNote(
  uid: string,
  note: DeliveryNote
): Promise<void> {
  await ensureUserRoot(uid);
  await setDoc(doc(deliveryNotesCol(uid), note.id), note, { merge: true });
}

export async function deleteDeliveryNote(
  uid: string,
  noteId: string
): Promise<void> {
  await deleteDoc(doc(deliveryNotesCol(uid), noteId));
}
