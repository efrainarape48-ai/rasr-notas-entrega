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
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AppSettings,
  CompanyProfile,
  Customer,
  Item,
  DeliveryNote,
} from '../types';

const nowIso = () => new Date().toISOString();

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

function mapDocWithId<T extends { id?: string }>(
  snap: QueryDocumentSnapshot<DocumentData>
): T {
  const data = snap.data() as T;
  return {
    ...data,
    id: data?.id ?? snap.id,
  } as T;
}

async function ensureUserRoot(uid: string) {
  await setDoc(
    userDoc(uid),
    {
      uid,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

function subscribeOrderedCollection<T extends { id?: string }>(
  uid: string,
  colFactory: (uid: string) => ReturnType<typeof collection>,
  callback: (rows: T[]) => void
): () => void {
  const q = query(colFactory(uid), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => mapDocWithId<T>(d));
      callback(rows);
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      callback([]);
    }
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
      updatedAt: nowIso(),
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
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export function subscribeToCustomers(
  uid: string,
  callback: (rows: Customer[]) => void
): () => void {
  return subscribeOrderedCollection<Customer>(uid, customersCol, callback);
}

export function subscribeToItems(
  uid: string,
  callback: (rows: Item[]) => void
): () => void {
  return subscribeOrderedCollection<Item>(uid, itemsCol, callback);
}

export function subscribeToDeliveryNotes(
  uid: string,
  callback: (rows: DeliveryNote[]) => void
): () => void {
  return subscribeOrderedCollection<DeliveryNote>(uid, deliveryNotesCol, callback);
}

export async function saveCustomer(
  uid: string,
  customer: Customer
): Promise<void> {
  await ensureUserRoot(uid);

  const payload: Customer = {
    ...customer,
    id: customer.id,
    createdAt: customer.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await setDoc(doc(customersCol(uid), payload.id), payload, { merge: true });
}

export async function deleteCustomer(
  uid: string,
  customerId: string
): Promise<void> {
  await deleteDoc(doc(customersCol(uid), customerId));
}

export async function saveItem(uid: string, item: Item): Promise<void> {
  await ensureUserRoot(uid);

  const payload: Item = {
    ...item,
    id: item.id,
    createdAt: item.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await setDoc(doc(itemsCol(uid), payload.id), payload, { merge: true });
}

export async function saveItemsBatch(uid: string, items: Item[]): Promise<void> {
  await ensureUserRoot(uid);

  const batch = writeBatch(db);

  items.forEach((item) => {
    const payload: Item = {
      ...item,
      id: item.id,
      createdAt: item.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    batch.set(doc(itemsCol(uid), payload.id), payload, { merge: true });
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

  const payload: DeliveryNote = {
    ...note,
    id: note.id,
    lines: Array.isArray(note.lines) ? note.lines : [],
    createdAt: note.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await setDoc(doc(deliveryNotesCol(uid), payload.id), payload, {
    merge: true,
  });
}

export async function deleteDeliveryNote(
  uid: string,
  noteId: string
): Promise<void> {
  await deleteDoc(doc(deliveryNotesCol(uid), noteId));
}
