import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';

export interface JobApplication {
  id?: string;
  jobTitle: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  coverLetter: string;
  resumeUrl?: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
}

const jobApplicationsCollectionRef = collection(db, 'job_applications');

export const addJobApplication = async (application: Omit<JobApplication, 'id' | 'createdAt' | 'status'>): Promise<string> => {
  const newApplicationRef = await addDoc(jobApplicationsCollectionRef, {
    ...application,
    status: 'pending',
    createdAt: Timestamp.now(),
  });
  return newApplicationRef.id;
};

export const getAllJobApplications = async (): Promise<JobApplication[]> => {
  const q = query(jobApplicationsCollectionRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as JobApplication[];
};

export const updateJobApplication = async (id: string, updates: Partial<JobApplication>): Promise<void> => {
  const docRef = doc(db, 'job_applications', id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

