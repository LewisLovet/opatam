/**
 * Callable: testFunction
 *
 * Fonction de test pour vérifier la connexion aux Cloud Functions
 * et l'accès à Firestore (vraie base de données).
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface ProviderSummary {
  id: string;
  businessName: string;
  category: string;
  isPublished: boolean;
}

interface BookingSummary {
  id: string;
  serviceName: string;
  clientName: string;
  status: string;
  datetime: string;
}

interface TestFunctionResponse {
  success: boolean;
  timestamp: string;
  data: {
    providersCount: number;
    providers: ProviderSummary[];
    bookingsCount: number;
    bookings: BookingSummary[];
  };
  message: string;
}

export const testFunction = onCall(
  async (request: CallableRequest): Promise<TestFunctionResponse> => {
    console.log('=== testFunction called ===');

    const db = admin.firestore();

    try {
      // Récupérer les providers
      console.log('Fetching providers...');
      const providersSnapshot = await db
        .collection('providers')
        .limit(5)
        .get();

      const providers: ProviderSummary[] = providersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          businessName: data.businessName || 'Sans nom',
          category: data.category || 'Non catégorisé',
          isPublished: data.isPublished || false,
        };
      });

      console.log(`Found ${providers.length} providers`);

      // Récupérer les bookings récents
      console.log('Fetching bookings...');
      const bookingsSnapshot = await db
        .collection('bookings')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const bookings: BookingSummary[] = bookingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          serviceName: data.serviceName || 'Service inconnu',
          clientName: data.clientInfo?.name || 'Client inconnu',
          status: data.status || 'unknown',
          datetime: data.datetime?.toDate?.()?.toISOString() || 'Date inconnue',
        };
      });

      console.log(`Found ${bookings.length} bookings`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          providersCount: providersSnapshot.size,
          providers,
          bookingsCount: bookingsSnapshot.size,
          bookings,
        },
        message: `Connexion réussie ! ${providersSnapshot.size} provider(s), ${bookingsSnapshot.size} booking(s).`,
      };
    } catch (error) {
      console.error('=== testFunction ERROR ===', error);

      // Retourner l'erreur de manière lisible au lieu de throw
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

      return {
        success: false,
        timestamp: new Date().toISOString(),
        data: {
          providersCount: 0,
          providers: [],
          bookingsCount: 0,
          bookings: [],
        },
        message: `Erreur: ${errorMessage}`,
      };
    }
  }
);
