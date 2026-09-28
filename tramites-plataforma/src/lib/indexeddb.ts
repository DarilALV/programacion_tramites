import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Entry, Junta } from './tramites-store';

interface TramitesDB extends DBSchema {
  entries: {
    key: string;
    value: Entry;
  };
  juntas: {
    key: string;
    value: Junta;
  };
  metadata: {
    key: string;
    value: {
      lastSync: string;
      currentUserId: string;
      currentTechnicianId?: string;
    };
  };
}

let db: IDBPDatabase<TramitesDB> | null = null;

async function getDB() {
  if (db) return db;

  db = await openDB<TramitesDB>('tramites-app', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('juntas')) {
        db.createObjectStore('juntas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    },
  });

  return db;
}

export async function saveToIndexedDB(entries: Entry[], juntas: Junta[], currentUserId: string, currentTechnicianId?: string) {
  try {
    const db = await getDB();
    const tx = db.transaction(['entries', 'juntas', 'metadata'], 'readwrite');

    // Guardar entries
    await tx.objectStore('entries').clear();
    for (const entry of entries) {
      await tx.objectStore('entries').put(entry);
    }

    // Guardar juntas
    await tx.objectStore('juntas').clear();
    for (const junta of juntas) {
      await tx.objectStore('juntas').put(junta);
    }

    // Guardar metadata
    await tx.objectStore('metadata').put(
      {
        lastSync: new Date().toISOString(),
        currentUserId,
        currentTechnicianId,
      },
      'state'
    );

    await tx.done;
    console.log('✅ Datos guardados en IndexedDB:', entries.length, 'entries');
    return true;
  } catch (error) {
    console.error('❌ Error guardando en IndexedDB:', error);
    return false;
  }
}

export async function loadFromIndexedDB() {
  try {
    const db = await getDB();
    const entries = await db.getAll('entries');
    const juntas = await db.getAll('juntas');
    const metadata = await db.get('metadata', 'state');

    if (entries.length > 0) {
      console.log('📂 Cargadas desde IndexedDB:', entries.length, 'entries');
      return { entries, juntas, metadata };
    }
    return null;
  } catch (error) {
    console.error('Error cargando desde IndexedDB:', error);
    return null;
  }
}

export async function clearIndexedDB() {
  try {
    const db = await getDB();
    await db.clear('entries');
    await db.clear('juntas');
    await db.clear('metadata');
    console.log('🗑️ IndexedDB limpiado');
  } catch (error) {
    console.error('Error limpiando IndexedDB:', error);
  }
}

export async function getIndexedDBStats() {
  try {
    const db = await getDB();
    const entryCount = await db.count('entries');
    const juntaCount = await db.count('juntas');
    return { entryCount, juntaCount };
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    return null;
  }
}
