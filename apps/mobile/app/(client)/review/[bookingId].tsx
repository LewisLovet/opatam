/**
 * Review Screen
 * Submit or update a review for a past booking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingService, reviewService } from '@booking-app/firebase';
import type { Booking, Review } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../../theme';
import { Text, Card, Button, useToast } from '../../../components';
import { useAuth } from '../../../contexts';

// Helper to convert datetime
function toDate(datetime: Date | any): Date {
  if (datetime instanceof Date) return datetime;
  if (datetime?.toDate) return datetime.toDate();
  return new Date(datetime);
}

function formatDate(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Star rating component
function StarRating({
  rating,
  onRate,
  size = 36,
  colors,
}: {
  rating: number;
  onRate: (value: number) => void;
  size?: number;
  colors: any;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onRate(star)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            padding: 4,
          })}
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#f59e0b' : colors.textSecondary}
          />
        </Pressable>
      ))}
    </View>
  );
}

// Rating label
function getRatingLabel(rating: number): string {
  switch (rating) {
    case 1: return 'Très insatisfait';
    case 2: return 'Insatisfait';
    case 3: return 'Correct';
    case 4: return 'Satisfait';
    case 5: return 'Très satisfait';
    default: return '';
  }
}

export default function ReviewScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<WithId<Booking> | null>(null);
  const [existingReview, setExistingReview] = useState<WithId<Review> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isUpdate = !!existingReview;

  // Load booking and check for existing review
  const loadData = useCallback(async () => {
    if (!bookingId || !user?.uid) {
      setError('Données manquantes');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bookingService.getById(bookingId);
      if (!result) {
        setError('Réservation non trouvée');
        setLoading(false);
        return;
      }

      setBooking(result);

      // Check for existing review for this provider by this client
      const canReviewResult = await reviewService.canReview(user.uid, bookingId);
      if (canReviewResult === 'can_update') {
        // Load the existing review
        const existing = await reviewService.getByEmailForProvider(
          result.clientInfo.email.toLowerCase().trim(),
          result.providerId
        );
        if (existing) {
          setExistingReview(existing);
          setRating(existing.rating);
          setComment(existing.comment || '');
        }
      } else if (canReviewResult === false) {
        setError('Vous ne pouvez pas laisser d\'avis pour cette réservation');
      }
    } catch (err: any) {
      console.error('Error loading review data:', err);
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [bookingId, user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle submit
  const handleSubmit = async () => {
    if (rating === 0) {
      showToast({ variant: 'error', message: 'Veuillez sélectionner une note' });
      return;
    }

    if (!booking || !user?.uid) return;

    setIsSubmitting(true);

    try {
      await reviewService.submitReview(user.uid, {
        providerId: booking.providerId,
        bookingId: booking.id,
        rating,
        comment: comment.trim() || null,
      });

      setIsSuccess(true);
      showToast({
        variant: 'success',
        message: isUpdate ? 'Avis mis à jour' : 'Merci pour votre avis !',
      });
    } catch (err: any) {
      console.error('Error submitting review:', err);
      showToast({
        variant: 'error',
        message: err.message || 'Erreur lors de l\'envoi',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Error state
  if (error || !booking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text variant="body" color="error" style={{ marginTop: spacing.md, textAlign: 'center' }}>
            {error || 'Réservation non trouvée'}
          </Text>
          <Button
            variant="outline"
            title="Retour"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </View>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
          </View>
          <Text variant="h2" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {isUpdate ? 'Avis mis à jour !' : 'Merci pour votre avis !'}
          </Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {isUpdate
              ? 'Votre avis a bien été mis à jour.'
              : 'Votre avis est désormais visible sur la page du prestataire.'}
          </Text>
          <Button
            variant="primary"
            title="Retour"
            onPress={() => router.back()}
            style={{ marginTop: spacing.xl, minWidth: 200 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text variant="h3" style={{ marginLeft: spacing.md }}>
              {isUpdate ? 'Modifier votre avis' : 'Donner votre avis'}
            </Text>
          </View>

          {/* Booking summary */}
          <Card padding="md" shadow="sm" style={{ marginTop: spacing.lg }}>
            <View style={styles.bookingSummary}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                <Ionicons name="calendar" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {booking.serviceName}
                </Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {booking.providerName}
                </Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {formatDate(booking.datetime)} à {formatTime(booking.datetime)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Rating */}
          <Card padding="lg" shadow="sm" style={{ marginTop: spacing.md }}>
            <Text variant="body" style={{ fontWeight: '600', textAlign: 'center', marginBottom: spacing.md }}>
              Comment était votre expérience ?
            </Text>
            <StarRating rating={rating} onRate={setRating} colors={colors} />
            {rating > 0 && (
              <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
                {getRatingLabel(rating)}
              </Text>
            )}
          </Card>

          {/* Comment */}
          <Card padding="lg" shadow="sm" style={{ marginTop: spacing.md }}>
            <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.sm }}>
              Votre commentaire (optionnel)
            </Text>
            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
              placeholder="Partagez votre expérience..."
              placeholderTextColor={colors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'right', marginTop: 4 }}>
              {comment.length}/1000
            </Text>
          </Card>

          {/* Submit */}
          <Button
            variant="primary"
            title={isUpdate ? 'Modifier mon avis' : 'Envoyer mon avis'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || rating === 0}
            style={{ marginTop: spacing.lg }}
          />

          {isUpdate && (
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>
              Vous avez déjà un avis pour cet établissement. L'envoyer remplacera votre avis précédent.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    // Dynamic styles
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  commentInput: {
    borderWidth: 1,
    padding: 12,
    height: 120,
    fontSize: 14,
  },
});
