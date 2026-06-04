import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebaseAuth';
import { Student, Appointment, ExamAppointment, TeacherPreferences } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface WorkspaceData {
  userId: string;
  teacherName: string;
  subject: string;
  currency: string;
  passcode: string;
  primaryColor?: string;
  enableWhatsApp24hReminders?: boolean;
  autoBackupDownloadInterval?: 'daily' | 'weekly' | 'monthly' | 'disabled';
  students: Student[];
  appointments: Appointment[];
  examAppointments: ExamAppointment[];
  updatedAt: string;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errMsg.toLowerCase().includes('offline') || 
                    errMsg.toLowerCase().includes('network') || 
                    errMsg.toLowerCase().includes('unavailable') ||
                    errMsg.toLowerCase().includes('failed to get document') ||
                    errMsg.toLowerCase().includes('could not reach') ||
                    errMsg.toLowerCase().includes('internet') ||
                    errMsg.toLowerCase().includes('connectivity') ||
                    errMsg.toLowerCase().includes('connection');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isOffline) {
    console.warn(`Firestore Offline/Network Warning: [${operationType}] on [${path}]. Error: ${errMsg}`);
  } else {
    console.error('Firestore Error details: ', JSON.stringify(errInfo));
  }

  const finalError = new Error(JSON.stringify(errInfo));
  (finalError as any).isOffline = isOffline;
  throw finalError;
}

/**
 * Recursively removes all undefined fields from an object, replacing them with null,
 * or omitting them entirely from keys to satisfy Firestore constraints.
 */
function sanitizeUndefined(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeUndefined(item));
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          newObj[key] = sanitizeUndefined(val);
        }
      }
    }
    return newObj;
  }
  return obj;
}

/**
 * Saves the entire teacher workspace state to Firestore.
 */
export async function saveWorkspaceToCloud(userId: string, data: Omit<WorkspaceData, 'userId' | 'updatedAt'>): Promise<void> {
  const docPath = `teachers/${userId}`;
  try {
    const payload: WorkspaceData = {
      ...data,
      userId,
      updatedAt: new Date().toISOString(),
    };
    const sanitizedPayload = sanitizeUndefined(payload);
    await setDoc(doc(db, 'teachers', userId), sanitizedPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Fetches the entire teacher workspace state from Firestore.
 */
export async function fetchWorkspaceFromCloud(userId: string): Promise<WorkspaceData | null> {
  const docPath = `teachers/${userId}`;
  try {
    const docRef = doc(db, 'teachers', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as WorkspaceData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
    return null;
  }
}
