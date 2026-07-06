/**
 * Email i18n — FR/EN texts for the CLIENT-facing transactional emails.
 *
 * DEPLOY CONSTRAINT (why this file exists): Cloud Functions never import
 * workspace packages at RUNTIME — only `import type` from @booking-app/* is
 * allowed (see the note in functions/src/utils/addressReveal.ts). The web and
 * mobile apps translate through packages/i18n; these email texts are the
 * LOCAL MIRROR of that convention inside functions. Keep the wording in sync
 * by hand when the product copy evolves.
 *
 * Scope: ONLY the 6 client senders in resendService.ts —
 * confirmation, reminder (24h/2h), cancellation (client version),
 * reschedule, review request, deposit reminder. Pro & system emails
 * (provider notifications, welcome, password reset…) stay 100% French.
 *
 * Locale source: `booking.clientLocale` ('fr' | 'en', absent = fr) — the
 * language the client booked in. Anything that isn't exactly 'en' falls
 * back to 'fr'.
 */

export type EmailLocale = 'fr' | 'en';

/** Resolve a raw locale value (booking.clientLocale) to a supported email locale. */
export function resolveEmailLocale(raw: string | null | undefined): EmailLocale {
  return raw === 'en' ? 'en' : 'fr';
}

// ---------------------------------------------------------------------------
// Locale-aware formatters
// ---------------------------------------------------------------------------
// Same rendering rules as formatDateFr / formatTimeFr / formatPriceFr in
// resendService, plus an English variant. Times stay 24h and Europe/Paris in
// BOTH languages — the appointment physically happens in France.

const INTL_LOCALE: Record<EmailLocale, string> = { fr: 'fr-FR', en: 'en-GB' };

export function formatEmailDate(date: Date, locale: EmailLocale = 'fr'): string {
  return date.toLocaleDateString(INTL_LOCALE[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
}

export function formatEmailTime(date: Date, locale: EmailLocale = 'fr'): string {
  return date.toLocaleTimeString(INTL_LOCALE[locale], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
    // Keep 24h in English too — French salon hours, and it matches the
    // fr-FR default so both languages read the same clock.
    ...(locale === 'en' ? { hour12: false } : {}),
  });
}

/** Price in centimes → localized string ("45,00 €" fr / "€45.00" en). */
export function formatEmailPrice(
  priceInCentimes: number,
  locale: EmailLocale = 'fr',
  priceMaxInCentimes?: number | null,
): string {
  const fmt = (v: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency: 'EUR',
    }).format(v / 100);
  if (priceMaxInCentimes && priceMaxInCentimes > priceInCentimes) {
    return locale === 'en'
      ? `From ${fmt(priceInCentimes)} to ${fmt(priceMaxInCentimes)}`
      : `De ${fmt(priceInCentimes)} à ${fmt(priceMaxInCentimes)}`;
  }
  return fmt(priceInCentimes);
}

/** Relative time for reminders ("dans 1h30" / "in 1h30", "demain" / "tomorrow"). */
export function formatEmailTimeUntil(minutesUntil: number, locale: EmailLocale = 'fr'): string {
  // Round to the nearest 5 minutes — clean multiples feel intentional.
  minutesUntil = Math.round(minutesUntil / 5) * 5;
  if (locale === 'en') {
    if (minutesUntil < 60) {
      return minutesUntil <= 1 ? 'in 1 minute' : `in ${minutesUntil} minutes`;
    }
    const hours = Math.floor(minutesUntil / 60);
    const mins = Math.round(minutesUntil % 60);
    if (hours >= 24) return 'tomorrow';
    if (mins === 0) {
      return hours === 1 ? 'in 1 hour' : `in ${hours} hours`;
    }
    return `in ${hours}h${mins.toString().padStart(2, '0')}`;
  }
  if (minutesUntil < 60) {
    const mins = minutesUntil;
    return mins <= 1 ? 'dans 1 minute' : `dans ${mins} minutes`;
  }
  const hours = Math.floor(minutesUntil / 60);
  const mins = Math.round(minutesUntil % 60);
  if (hours >= 24) return 'demain';
  if (mins === 0) {
    return hours === 1 ? 'dans 1 heure' : `dans ${hours} heures`;
  }
  return `dans ${hours}h${mins.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------
// Convention: *Html leaves may embed small inline-styled fragments (the exact
// markup previously hardcoded in the templates) so the HTML output stays
// byte-identical in French. *Text leaves are the plain-text mirrors.
// `colon` carries the French typographic space (" :" vs ":").

export const EMAIL_TEXTS = {
  // Shared across the client emails (labels, footers, calendar block, ICS…)
  common: {
    fr: {
      greeting: (name: string) => `Bonjour ${name},`,
      signoff: 'À bientôt,',
      footerAuto: (appName: string) => `Cet email a été envoyé automatiquement par ${appName}.`,
      footerIgnore: "Si vous n'êtes pas concerné, veuillez ignorer ce message.",
      colon: ' :',
      labels: {
        service: 'Prestation',
        date: 'Date',
        time: 'Heure',
        duration: 'Durée',
        location: 'Lieu',
        address: 'Adresse',
        area: 'Secteur',
        directions: 'Itinéraire',
        with: 'Avec',
        price: 'Prix',
        deposit: 'Acompte',
        depositPaid: 'Acompte payé',
        remaining: 'Reste à régler',
        remainingOnSite: 'Reste à régler sur place',
        reason: 'Motif',
        at: 'Chez',
      },
      onSite: 'sur place',
      addToCalendar: 'Ajouter à votre calendrier',
      updateCalendar: 'Mettre à jour votre calendrier',
      addToCalendarText: 'Ajouter à votre calendrier :',
      updateCalendarText: 'Mettre à jour votre calendrier :',
      calendarGoogle: 'Google',
      calendarGoogleText: 'Google Calendar',
      calendarApple: 'Apple / Outlook',
      cancelCta: 'Annuler le rendez-vous',
      cancelLineText: (url: string) => `Annuler le rendez-vous : ${url}`,
      rebookCta: 'Reprendre rendez-vous',
      // HTML-entity encoded on purpose — mirrors the historical markup.
      directionsCta: 'Voir l&#39;itin&#233;raire',
      accessInfoTitleHtml: 'Informations d&#39;acc&#232;s',
      accessInfoTitleText: "Informations d'accès",
      addressPendingHtml: (when: string) =>
        `L&#39;adresse exacte et les informations d&#39;acc&#232;s vous seront communiqu&#233;es${when} avec votre rappel, avant le rendez-vous.`,
      addressPendingText: (when: string) =>
        `L'adresse exacte et les informations d'accès vous seront communiquées${when} avec votre rappel, avant le rendez-vous.`,
      onDate: (formattedDate: string) => ` le ${formattedDate}`,
      promoWas: (formattedOriginal: string, pct: number) =>
        ` (au lieu de ${formattedOriginal}, −${pct} %)`,
      providerNoticeTitle: (businessName: string) => `Information de ${businessName}`,
      ics: {
        filename: 'rendez-vous.ics',
        summary: (serviceName: string, businessName: string) =>
          `RDV - ${serviceName} chez ${businessName}`,
        withMember: (memberName: string) => `Avec ${memberName}`,
        atBusiness: (businessName: string) => `Chez ${businessName}`,
        cancelLine: (url: string) => `Pour annuler : ${url}`,
      },
    },
    en: {
      greeting: (name: string) => `Hello ${name},`,
      signoff: 'See you soon,',
      footerAuto: (appName: string) => `This email was sent automatically by ${appName}.`,
      footerIgnore: 'If this message was not meant for you, please ignore it.',
      colon: ':',
      labels: {
        service: 'Service',
        date: 'Date',
        time: 'Time',
        duration: 'Duration',
        location: 'Location',
        address: 'Address',
        area: 'Area',
        directions: 'Directions',
        with: 'With',
        price: 'Price',
        deposit: 'Deposit',
        depositPaid: 'Deposit paid',
        remaining: 'Balance due',
        remainingOnSite: 'Balance due on site',
        reason: 'Reason',
        at: 'At',
      },
      onSite: 'on site',
      addToCalendar: 'Add to your calendar',
      updateCalendar: 'Update your calendar',
      addToCalendarText: 'Add to your calendar:',
      updateCalendarText: 'Update your calendar:',
      calendarGoogle: 'Google',
      calendarGoogleText: 'Google Calendar',
      calendarApple: 'Apple / Outlook',
      cancelCta: 'Cancel appointment',
      cancelLineText: (url: string) => `Cancel appointment: ${url}`,
      rebookCta: 'Book again',
      directionsCta: 'Get directions',
      accessInfoTitleHtml: 'Access details',
      accessInfoTitleText: 'Access details',
      addressPendingHtml: (when: string) =>
        `The exact address and access details will be sent to you${when} with your reminder, before your appointment.`,
      addressPendingText: (when: string) =>
        `The exact address and access details will be sent to you${when} with your reminder, before your appointment.`,
      onDate: (formattedDate: string) => ` on ${formattedDate}`,
      promoWas: (formattedOriginal: string, pct: number) =>
        ` (was ${formattedOriginal}, −${pct}%)`,
      providerNoticeTitle: (businessName: string) => `A note from ${businessName}`,
      ics: {
        filename: 'appointment.ics',
        summary: (serviceName: string, businessName: string) =>
          `Appointment - ${serviceName} at ${businessName}`,
        withMember: (memberName: string) => `With ${memberName}`,
        atBusiness: (businessName: string) => `At ${businessName}`,
        cancelLine: (url: string) => `To cancel: ${url}`,
      },
    },
  },

  confirmation: {
    fr: {
      subject: (serviceName: string) => `Confirmation de votre rendez-vous - ${serviceName}`,
      subjectUpdated: (businessName: string) =>
        `Votre rendez-vous a été mis à jour - ${businessName}`,
      introHtml: 'Votre rendez-vous a bien été <strong style="color: #16a34a;">confirmé</strong>.',
      introText: 'Votre rendez-vous a bien été confirmé.',
      updateAddedHtml: (serviceName: string) =>
        `Une prestation a été <strong style="color: #16a34a;">ajoutée à</strong> votre rendez-vous&nbsp;: <strong>${serviceName}</strong>.`,
      updateRemovedHtml: (serviceName: string) =>
        `Une prestation a été <strong style="color: #dc2626;">retirée de</strong> votre rendez-vous&nbsp;: <strong>${serviceName}</strong>.`,
      updateAddedText: (serviceName: string) =>
        `Une prestation a été ajoutée à votre rendez-vous : ${serviceName}.`,
      updateRemovedText: (serviceName: string) =>
        `Une prestation a été retirée de votre rendez-vous : ${serviceName}.`,
      updatedSub: 'Voici votre rendez-vous mis à jour.',
      boxTitleMulti: 'Vos prestations',
      boxTitleSingle: 'Votre rendez-vous',
      detailsHeading: 'Détails de votre rendez-vous :',
      reviewFooterHtml: (url: string) =>
        `Après votre rendez-vous, <a href="${url}" style="color: #6366f1; text-decoration: underline;">donnez-nous votre avis</a>`,
      reviewFooterText: (url: string) =>
        `Après votre rendez-vous, donnez-nous votre avis : ${url}`,
    },
    en: {
      subject: (serviceName: string) => `Your appointment is confirmed - ${serviceName}`,
      subjectUpdated: (businessName: string) =>
        `Your appointment has been updated - ${businessName}`,
      introHtml: 'Your appointment has been <strong style="color: #16a34a;">confirmed</strong>.',
      introText: 'Your appointment has been confirmed.',
      updateAddedHtml: (serviceName: string) =>
        `A service has been <strong style="color: #16a34a;">added to</strong> your appointment: <strong>${serviceName}</strong>.`,
      updateRemovedHtml: (serviceName: string) =>
        `A service has been <strong style="color: #dc2626;">removed from</strong> your appointment: <strong>${serviceName}</strong>.`,
      updateAddedText: (serviceName: string) =>
        `A service has been added to your appointment: ${serviceName}.`,
      updateRemovedText: (serviceName: string) =>
        `A service has been removed from your appointment: ${serviceName}.`,
      updatedSub: 'Here is your updated appointment.',
      boxTitleMulti: 'Your services',
      boxTitleSingle: 'Your appointment',
      detailsHeading: 'Your appointment details:',
      reviewFooterHtml: (url: string) =>
        `After your appointment, <a href="${url}" style="color: #6366f1; text-decoration: underline;">leave us a review</a>`,
      reviewFooterText: (url: string) => `After your appointment, leave us a review: ${url}`,
    },
  },

  reminder: {
    fr: {
      subject: (timeLabel: string, serviceName: string) =>
        `Rappel : votre rendez-vous ${timeLabel} - ${serviceName}`,
      introHtml: (timeLabel: string) =>
        `Nous vous rappelons que votre rendez-vous a lieu <strong style="color: #2563eb;">${timeLabel}</strong>.`,
      introText: (timeLabel: string) =>
        `Nous vous rappelons que votre rendez-vous a lieu ${timeLabel}.`,
      boxTitle: 'Rappel de rendez-vous',
      detailsHeading: 'Détails de votre rendez-vous :',
      tomorrow: 'demain',
      inTwoDays: 'dans 2 jours',
      inTwoHours: 'dans 2 heures',
    },
    en: {
      subject: (timeLabel: string, serviceName: string) =>
        `Reminder: your appointment ${timeLabel} - ${serviceName}`,
      introHtml: (timeLabel: string) =>
        `Just a friendly reminder — your appointment is <strong style="color: #2563eb;">${timeLabel}</strong>.`,
      introText: (timeLabel: string) =>
        `Just a friendly reminder — your appointment is ${timeLabel}.`,
      boxTitle: 'Appointment reminder',
      detailsHeading: 'Your appointment details:',
      tomorrow: 'tomorrow',
      inTwoDays: 'in 2 days',
      inTwoHours: 'in 2 hours',
    },
  },

  cancellation: {
    fr: {
      subject: (serviceName: string) => `Annulation de votre rendez-vous - ${serviceName}`,
      introHtml:
        'Nous vous informons que votre rendez-vous a été <strong style="color: #dc2626;">annulé</strong>.',
      introText: 'Nous vous informons que votre rendez-vous a été annulé.',
      boxTitle: 'Rendez-vous annulé',
      detailsHeading: 'Détails du rendez-vous annulé :',
      refundedTitle: '✓ Acompte remboursé',
      refundedBodyHtml: (formattedAmount: string) =>
        `Votre acompte de <strong>${formattedAmount}</strong> est en cours de remboursement sur votre moyen de paiement. Comptez 5 à 10 jours ouvrés pour le voir apparaître.`,
      refundedText: (formattedAmount: string) =>
        `✓ Votre acompte de ${formattedAmount} est en cours de remboursement (5 à 10 jours ouvrés).`,
      unrefundedTitle: 'Acompte non remboursé',
      unrefundedBodyHtml: (formattedAmount: string, businessName: string) =>
        `Votre acompte de <strong>${formattedAmount}</strong> n'est pas remboursable car la demande d'annulation est intervenue après le délai de remboursement fixé par ${businessName}.`,
      unrefundedContactHtml: (businessName: string) =>
        `Pour toute demande exceptionnelle, contactez directement ${businessName}.`,
      unrefundedText: (formattedAmount: string, businessName: string) =>
        `⚠ Votre acompte de ${formattedAmount} n'est pas remboursable car la demande d'annulation est intervenue après le délai fixé par ${businessName}.`,
      rebookPromptHtml:
        "Si vous souhaitez reprendre un nouveau rendez-vous, n'hésitez pas à nous contacter ou à réserver en ligne.",
      rebookPromptText: (url: string) =>
        `Si vous souhaitez reprendre un nouveau rendez-vous, n'hésitez pas à nous contacter ou à réserver en ligne sur ${url}`,
      apology: 'Nous nous excusons pour la gêne occasionnée.',
    },
    en: {
      subject: (serviceName: string) => `Your appointment has been cancelled - ${serviceName}`,
      introHtml:
        "We're sorry to let you know that your appointment has been <strong style=\"color: #dc2626;\">cancelled</strong>.",
      introText: "We're sorry to let you know that your appointment has been cancelled.",
      boxTitle: 'Cancelled appointment',
      detailsHeading: 'Cancelled appointment details:',
      refundedTitle: '✓ Deposit refunded',
      refundedBodyHtml: (formattedAmount: string) =>
        `Your deposit of <strong>${formattedAmount}</strong> is being refunded to your payment method. Please allow 5 to 10 business days for it to appear.`,
      refundedText: (formattedAmount: string) =>
        `✓ Your deposit of ${formattedAmount} is being refunded (please allow 5 to 10 business days).`,
      unrefundedTitle: 'Deposit not refunded',
      unrefundedBodyHtml: (formattedAmount: string, businessName: string) =>
        `Your deposit of <strong>${formattedAmount}</strong> is non-refundable because the cancellation was requested after the refund deadline set by ${businessName}.`,
      unrefundedContactHtml: (businessName: string) =>
        `For any exceptional request, please contact ${businessName} directly.`,
      unrefundedText: (formattedAmount: string, businessName: string) =>
        `⚠ Your deposit of ${formattedAmount} is non-refundable because the cancellation was requested after the deadline set by ${businessName}.`,
      rebookPromptHtml:
        "If you'd like to book a new appointment, feel free to contact us or book online.",
      rebookPromptText: (url: string) =>
        `If you'd like to book a new appointment, you can book online at ${url}`,
      apology: 'We apologise for the inconvenience.',
    },
  },

  reschedule: {
    fr: {
      subject: (serviceName: string) => `Modification de votre rendez-vous - ${serviceName}`,
      introHtml: 'Votre rendez-vous a été <strong style="color: #2563eb;">modifié</strong>.',
      introText: 'Votre rendez-vous a été modifié.',
      oldSlotTitle: 'Ancien créneau',
      newSlotTitle: 'Nouveau créneau',
      atJoiner: 'à',
      oldSlotLineText: (formattedDate: string, formattedTime: string) =>
        `Ancien créneau : ${formattedDate} à ${formattedTime}`,
      newSlotHeadingText: 'Nouveau créneau :',
    },
    en: {
      subject: (serviceName: string) => `Your appointment has been rescheduled - ${serviceName}`,
      introHtml: 'Your appointment has been <strong style="color: #2563eb;">rescheduled</strong>.',
      introText: 'Your appointment has been rescheduled.',
      oldSlotTitle: 'Previous slot',
      newSlotTitle: 'New slot',
      atJoiner: 'at',
      oldSlotLineText: (formattedDate: string, formattedTime: string) =>
        `Previous slot: ${formattedDate} at ${formattedTime}`,
      newSlotHeadingText: 'New slot:',
    },
  },

  review: {
    fr: {
      subject: (serviceName: string) =>
        `Donnez votre avis sur votre rendez-vous - ${serviceName}`,
      htmlLang: 'fr',
      eyebrow: 'Votre avis compte',
      heading: "Comment s'est passé votre rendez-vous ?",
      body: "Nous espérons que votre rendez-vous s'est bien passé. Votre avis aide d'autres clients à choisir et nous aide à améliorer nos services.",
      boxTitle: 'Votre rendez-vous',
      boxTitleText: 'Votre rendez-vous :',
      cta: 'Donner mon avis',
      ctaLineText: 'Donnez votre avis ici :',
      visibleNote: (providerName: string) =>
        `Votre avis sera visible sur la page de ${providerName}.`,
      sentBy: 'Email envoyé par',
    },
    en: {
      subject: (serviceName: string) => `How did your appointment go? - ${serviceName}`,
      htmlLang: 'en',
      eyebrow: 'Your feedback matters',
      heading: 'How did your appointment go?',
      body: 'We hope your appointment went well. Your review helps other clients choose — and helps us keep improving.',
      boxTitle: 'Your appointment',
      boxTitleText: 'Your appointment:',
      cta: 'Leave a review',
      ctaLineText: 'Leave your review here:',
      visibleNote: (providerName: string) =>
        `Your review will appear on ${providerName}'s page.`,
      sentBy: 'Email sent by',
    },
  },

  depositReminder: {
    fr: {
      subject: (serviceName: string, providerName: string) =>
        `Acompte en attente — ${serviceName} chez ${providerName}`,
      introHtml: (providerName: string) =>
        `Votre rendez-vous chez <strong>${providerName}</strong> est <strong style="color: #d97706;">en attente du paiement de votre acompte</strong>.`,
      introText: (providerName: string) =>
        `Votre rendez-vous chez ${providerName} est en attente du paiement de votre acompte.`,
      boxTitle: 'Rendez-vous en attente',
      deadlineHtml: (minutesLeft: number) =>
        `Sans paiement de l'acompte dans les <strong>${minutesLeft} minutes</strong>, votre créneau sera automatiquement libéré.`,
      deadlineText: (minutesLeft: number) =>
        `Sans paiement de l'acompte dans les ${minutesLeft} minutes, votre créneau sera automatiquement libéré.`,
      payCta: 'Régler mon acompte maintenant',
      payLineText: (url: string) => `Régler mon acompte : ${url}`,
      cancelQuestionHtml: (url: string) =>
        `Vous ne pourrez pas honorer ce rendez-vous ? <a href="${url}" style="color: #dc2626; text-decoration: underline;">Annuler la réservation</a>.`,
      cancelLineText: (url: string) => `Annuler la réservation : ${url}`,
      signoff: 'À très vite,',
    },
    en: {
      subject: (serviceName: string, providerName: string) =>
        `Deposit pending — ${serviceName} at ${providerName}`,
      introHtml: (providerName: string) =>
        `Your appointment at <strong>${providerName}</strong> is <strong style="color: #d97706;">waiting for your deposit payment</strong>.`,
      introText: (providerName: string) =>
        `Your appointment at ${providerName} is waiting for your deposit payment.`,
      boxTitle: 'Appointment on hold',
      deadlineHtml: (minutesLeft: number) =>
        `If the deposit isn't paid within <strong>${minutesLeft} minutes</strong>, your slot will be automatically released.`,
      deadlineText: (minutesLeft: number) =>
        `If the deposit isn't paid within ${minutesLeft} minutes, your slot will be automatically released.`,
      payCta: 'Pay my deposit now',
      payLineText: (url: string) => `Pay my deposit: ${url}`,
      cancelQuestionHtml: (url: string) =>
        `Can't make this appointment? <a href="${url}" style="color: #dc2626; text-decoration: underline;">Cancel the booking</a>.`,
      cancelLineText: (url: string) => `Cancel the booking: ${url}`,
      signoff: 'See you very soon,',
    },
  },
} as const;
