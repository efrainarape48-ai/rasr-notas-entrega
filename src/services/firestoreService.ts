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
  runTransaction,
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
  DeliveryNoteLine,
} from '../types';

type StoredDeliveryNote = DeliveryNote & {
  inventoryApplied?: boolean;
};

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

function deepClean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => deepClean(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, deepClean(v)]);

    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
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

function normalizeLines(lines: DeliveryNoteLine[] | undefined): DeliveryNoteLine[] {
  return Array.isArray(lines) ? lines : [];
}

function statusConsumesStock(note: Pick<DeliveryNote, 'status'> | null | undefined) {
  return !!note;
}

function inventoryWasApplied(note: StoredDeliveryNote | null | undefined) {
  if (!statusConsumesStock(note)) {
    return false;
  }

  // Compatibilidad con notas antiguas guardadas antes de existir inventoryApplied.
  // Si el campo no existe, asumimos que la nota ya había impactado inventario.
  return note?.inventoryApplied !== false;
}

function aggregateLineQuantities(lines: DeliveryNoteLine[] | undefined) {
  const quantities = new Map<string, { quantity: number; name: string }>();

  normalizeLines(lines).forEach((line) => {
    if (!line?.itemId) return;

    const current = quantities.get(line.itemId);
    quantities.set(line.itemId, {
      quantity: (current?.quantity || 0) + Number(line.quantity || 0),
      name: line.name || current?.name || line.itemId,
    });
  });

  return quantities;
}

function getEffectiveInventoryImpact(note: StoredDeliveryNote | null | undefined) {
  if (!inventoryWasApplied(note)) {
    return new Map<string, { quantity: number; name: string }>();
  }

  return aggregateLineQuantities(note?.lines);
}

function buildInventoryAdjustments(
  previousNote: StoredDeliveryNote | null | undefined,
  nextNote: StoredDeliveryNote | null | undefined
) {
  const previous = getEffectiveInventoryImpact(previousNote);
  const next = getEffectiveInventoryImpact(nextNote);
  const itemIds = new Set([...previous.keys(), ...next.keys()]);

  const adjustments = new Map<string, { delta: number; name: string }>();

  itemIds.forEach((itemId) => {
    const previousQty = previous.get(itemId)?.quantity || 0;
    const nextQty = next.get(itemId)?.quantity || 0;
    const delta = previousQty - nextQty;

    if (delta !== 0) {
      adjustments.set(itemId, {
        delta,
        name: next.get(itemId)?.name || previous.get(itemId)?.name || itemId,
      });
    }
  });

  return adjustments;
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

  const payload = deepClean({
    ...profile,
    updatedAt: nowIso(),
  });

  await setDoc(companyProfileDoc(uid), payload, { merge: true });
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

  const payload = deepClean({
    ...settings,
    updatedAt: nowIso(),
  });

  await setDoc(appSettingsDoc(uid), payload, { merge: true });
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

  const payload = deepClean({
    ...customer,
    id: customer.id,
    createdAt: customer.createdAt || nowIso(),
    updatedAt: nowIso(),
  }) as Customer;

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

  const payload = deepClean({
    ...item,
    id: item.id,
    createdAt: item.createdAt || nowIso(),
    updatedAt: nowIso(),
  }) as Item;

  await setDoc(doc(itemsCol(uid), payload.id), payload, { merge: true });
}

export async function saveItemsBatch(uid: string, items: Item[]): Promise<void> {
  await ensureUserRoot(uid);

  const batch = writeBatch(db);

  items.forEach((item) => {
    const payload = deepClean({
      ...item,
      id: item.id,
      createdAt: item.createdAt || nowIso(),
      updatedAt: nowIso(),
    }) as Item;

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

  const payload = deepClean({
    ...note,
    id: note.id,
    lines: normalizeLines(note.lines),
    createdAt: note.createdAt || nowIso(),
    updatedAt: nowIso(),
    inventoryApplied: statusConsumesStock(note),
  }) as StoredDeliveryNote;

  await runTransaction(db, async (transaction) => {
    const noteRef = doc(deliveryNotesCol(uid), payload.id);
    const previousNoteSnap = await transaction.get(noteRef);
    const previousNote = previousNoteSnap.exists()
      ? (previousNoteSnap.data() as StoredDeliveryNote)
      : null;

    const adjustments = buildInventoryAdjustments(previousNote, payload);

    for (const [itemId, { delta, name }] of adjustments.entries()) {
      const itemRef = doc(itemsCol(uid), itemId);
      const itemSnap = await transaction.get(itemRef);

      if (!itemSnap.exists()) {
        if (delta > 0) {
          continue;
        }

        throw new Error(`El producto "${name}" ya no existe en inventario.`);
      }

      const itemData = itemSnap.data() as Item;
      const currentStock = Number(itemData.stock ?? 0);
      const nextStock = currentStock + delta;

      if (nextStock < 0) {
        throw new Error(
          `Stock insuficiente para "${name}". Disponible: ${currentStock}.`
        );
      }

      transaction.update(itemRef, {
        stock: nextStock,
        updatedAt: nowIso(),
      });
    }

    transaction.set(noteRef, payload, {
      merge: true,
    });
  });
}

export async function deleteDeliveryNote(
  uid: string,
  noteId: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const noteRef = doc(deliveryNotesCol(uid), noteId);
    const noteSnap = await transaction.get(noteRef);

    if (!noteSnap.exists()) {
      return;
    }

    const existingNote = noteSnap.data() as StoredDeliveryNote;
    const adjustments = buildInventoryAdjustments(existingNote, null);

    for (const [itemId, { delta }] of adjustments.entries()) {
      const itemRef = doc(itemsCol(uid), itemId);
      const itemSnap = await transaction.get(itemRef);

      if (!itemSnap.exists()) {
        continue;
      }

      const itemData = itemSnap.data() as Item;
      const currentStock = Number(itemData.stock ?? 0);
      const nextStock = currentStock + delta;

      transaction.update(itemRef, {
        stock: Math.max(0, nextStock),
        updatedAt: nowIso(),
      });
    }

    transaction.delete(noteRef);
  });
}
