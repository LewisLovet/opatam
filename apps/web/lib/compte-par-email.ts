import { getAdminAuth } from '@/lib/firebase-admin';

/** L'uid du compte Firebase de cette adresse, ou `null` s'il n'y en a pas. */
export async function trouverCompteParEmail(email: string): Promise<string | null> {
  try {
    return (await getAdminAuth().getUserByEmail(email)).uid;
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/user-not-found') return null;
    throw err;
  }
}
