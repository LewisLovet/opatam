import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { providerId } = await params;
    const db = getAdminFirestore();

    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json({ error: 'Prestataire non trouvé' }, { status: 404 });
    }

    const providerData = providerDoc.data()!;

    // Fetch related data in parallel (select() for bookings: downloads only doc IDs, not full data)
    const [userDoc, servicesSnap, membersSnap, locationsSnap, bookingsSnap] = await Promise.all([
      db.collection('users').doc(providerData.userId).get(),
      db.collection('providers').doc(providerId).collection('services').get(),
      db.collection('providers').doc(providerId).collection('members').get(),
      db.collection('providers').doc(providerId).collection('locations').get(),
      db.collection('bookings').where('providerId', '==', providerId).select('status').get(),
    ]);

    const userData = userDoc.exists ? userDoc.data()! : null;

    // Serialize provider
    const provider = {
      id: providerId,
      userId: providerData.userId,
      businessName: providerData.businessName,
      description: providerData.description,
      category: providerData.category,
      slug: providerData.slug,
      photoURL: providerData.photoURL,
      coverPhotoURL: providerData.coverPhotoURL,
      socialLinks: providerData.socialLinks,
      rating: providerData.rating,
      settings: providerData.settings,
      subscription: {
        plan: providerData.subscription?.plan,
        tier: providerData.subscription?.tier,
        memberCount: providerData.subscription?.memberCount,
        status: providerData.subscription?.status,
        stripeCustomerId: providerData.subscription?.stripeCustomerId,
        stripeSubscriptionId: providerData.subscription?.stripeSubscriptionId,
        validUntil: providerData.subscription?.validUntil?.toDate?.()?.toISOString() || null,
        currentPeriodEnd: providerData.subscription?.currentPeriodEnd?.toDate?.()?.toISOString() || null,
        cancelAtPeriodEnd: providerData.subscription?.cancelAtPeriodEnd || false,
        paymentSource: providerData.subscription?.paymentSource || null,
      },
      isPublished: providerData.isPublished || false,
      isVerified: providerData.isVerified || false,
      cities: providerData.cities || [],
      region: providerData.region || null,
      createdAt: providerData.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: providerData.updatedAt?.toDate?.()?.toISOString() || null,
    };

    // Serialize user
    const user = userData
      ? {
          id: providerData.userId,
          email: userData.email,
          displayName: userData.displayName,
          phone: userData.phone,
          photoURL: userData.photoURL,
          role: userData.role,
          isDisabled: userData.isDisabled || false,
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
        }
      : null;

    // Services
    const services = servicesSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        duration: d.duration,
        price: d.price,
        isActive: d.isActive,
      };
    });

    // Members
    const members = membersSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        email: d.email,
        isActive: d.isActive,
        isDefault: d.isDefault,
      };
    });

    // Locations
    const locations = locationsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        address: d.address,
        city: d.city,
        postalCode: d.postalCode || null,
        type: d.type,
        isActive: d.isActive,
        isDefault: d.isDefault,
      };
    });

    // Booking stats (from select('status') — only status field downloaded, not full docs)
    const bookingStats = {
      total: bookingsSnap.size,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      noshow: 0,
    };

    bookingsSnap.docs.forEach((doc) => {
      const status = doc.data().status;
      if (status in bookingStats) {
        (bookingStats as any)[status]++;
      }
    });

    return NextResponse.json({
      provider,
      user,
      services,
      members,
      locations,
      bookingStats,
    });
  } catch (error) {
    console.error('[admin/providers/[providerId]] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { providerId } = await params;
    const body = await request.json();
    const db = getAdminFirestore();

    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json({ error: 'Prestataire non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (typeof body.isVerified === 'boolean') {
      updateData.isVerified = body.isVerified;
    }
    if (typeof body.isPublished === 'boolean') {
      updateData.isPublished = body.isPublished;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    updateData.updatedAt = new Date();
    await db.collection('providers').doc(providerId).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/providers/[providerId]] PATCH Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/providers/[providerId]
 * Completely deletes a provider account: subcollections, provider doc, user doc, Firebase Auth
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { providerId } = await params;
    const db = getAdminFirestore();
    const auth = getAdminAuth();

    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json({ error: 'Prestataire non trouvé' }, { status: 404 });
    }

    const providerData = providerDoc.data()!;
    const userId = providerData.userId;

    // 1. Delete all provider subcollections in parallel
    const subcollections = ['members', 'locations', 'services', 'availabilities', 'blockedSlots'];
    await Promise.all(
      subcollections.map(async (subcol) => {
        const snap = await db.collection('providers').doc(providerId).collection(subcol).get();
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        if (snap.size > 0) await batch.commit();
      })
    );

    // 2. Delete provider document
    await db.collection('providers').doc(providerId).delete();

    // 3. Delete user document from Firestore
    if (userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        await db.collection('users').doc(userId).delete();
      }
    }

    // 4. Delete Firebase Auth account
    if (userId) {
      try {
        await auth.deleteUser(userId);
      } catch (authErr: any) {
        // User may already be deleted from Auth
        if (authErr.code !== 'auth/user-not-found') {
          console.error('[admin/providers/DELETE] Auth deletion error:', authErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/providers/[providerId]] DELETE Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
