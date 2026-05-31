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
                    errMsg.toLowerCase().includes('unavailable');

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
    await setDoc(doc(db, 'teachers', userId), payload);
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
