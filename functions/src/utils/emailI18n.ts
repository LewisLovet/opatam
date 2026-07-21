/**
 * Email i18n — FR/EN/IT texts for the CLIENT-facing transactional emails.
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
 * Locale source: `booking.clientLocale` ('fr' | 'en' | 'it', absent = fr) —
 * the language the client booked in. Anything that isn't exactly 'en' or
 * 'it' falls back to 'fr'.
 */

export type EmailLocale = 'fr' | 'en' | 'it';

/** Resolve a raw locale value (booking.clientLocale) to a supported email locale. */
export function resolveEmailLocale(raw: string | null | undefined): EmailLocale {
  return raw === 'en' || raw === 'it' ? raw : 'fr';
}

// ---------------------------------------------------------------------------
// Locale-aware formatters
// ---------------------------------------------------------------------------
// Same rendering rules as formatDateFr / formatTimeFr / formatPriceFr in
// resendService, plus English and Italian variants. Times stay 24h and
// Europe/Paris in ALL languages — the appointment physically happens in France.

const INTL_LOCALE: Record<EmailLocale, string> = { fr: 'fr-FR', en: 'en-GB', it: 'it-IT' };

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
    // Keep 24h in English (and Italian) too — French salon hours, and it
    // matches the fr-FR default so every language reads the same clock.
    ...(locale !== 'fr' ? { hour12: false } : {}),
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
    if (locale === 'en') return `From ${fmt(priceInCentimes)} to ${fmt(priceMaxInCentimes)}`;
    if (locale === 'it') return `Da ${fmt(priceInCentimes)} a ${fmt(priceMaxInCentimes)}`;
    return `De ${fmt(priceInCentimes)} à ${fmt(priceMaxInCentimes)}`;
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
  if (locale === 'it') {
    if (minutesUntil < 60) {
      return minutesUntil <= 1 ? 'tra 1 minuto' : `tra ${minutesUntil} minuti`;
    }
    const hours = Math.floor(minutesUntil / 60);
    const mins = Math.round(minutesUntil % 60);
    if (hours >= 24) return 'domani';
    if (mins === 0) {
      return hours === 1 ? 'tra 1 ora' : `tra ${hours} ore`;
    }
    return `tra ${hours}h${mins.toString().padStart(2, '0')}`;
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
    it: {
      greeting: (name: string) => `Buongiorno ${name},`,
      signoff: 'A presto,',
      footerAuto: (appName: string) =>
        `Questa email è stata inviata automaticamente da ${appName}.`,
      footerIgnore: 'Se questo messaggio non La riguarda, La preghiamo di ignorarlo.',
      colon: ':',
      labels: {
        service: 'Prestazione',
        date: 'Data',
        time: 'Ora',
        duration: 'Durata',
        location: 'Luogo',
        address: 'Indirizzo',
        area: 'Zona',
        directions: 'Itinerario',
        with: 'Con',
        price: 'Prezzo',
        deposit: 'Acconto',
        depositPaid: 'Acconto versato',
        remaining: 'Saldo da pagare',
        remainingOnSite: 'Saldo da pagare in loco',
        reason: 'Motivo',
        at: 'Presso',
      },
      onSite: 'in loco',
      addToCalendar: 'Aggiungi al calendario',
      updateCalendar: 'Aggiorna il calendario',
      addToCalendarText: 'Aggiungi al calendario:',
      updateCalendarText: 'Aggiorna il calendario:',
      calendarGoogle: 'Google',
      calendarGoogleText: 'Google Calendar',
      calendarApple: 'Apple / Outlook',
      cancelCta: "Annulla l'appuntamento",
      cancelLineText: (url: string) => `Annulla l'appuntamento: ${url}`,
      rebookCta: 'Prenota di nuovo',
      // HTML-entity encoded on purpose — mirrors the historical markup.
      directionsCta: 'Vedi l&#39;itinerario',
      accessInfoTitleHtml: 'Informazioni di accesso',
      accessInfoTitleText: 'Informazioni di accesso',
      addressPendingHtml: (when: string) =>
        `L&#39;indirizzo esatto e le informazioni di accesso Le saranno comunicati${when} insieme al promemoria, prima dell&#39;appuntamento.`,
      addressPendingText: (when: string) =>
        `L'indirizzo esatto e le informazioni di accesso Le saranno comunicati${when} insieme al promemoria, prima dell'appuntamento.`,
      onDate: (formattedDate: string) => ` il ${formattedDate}`,
      promoWas: (formattedOriginal: string, pct: number) =>
        ` (anziché ${formattedOriginal}, −${pct}%)`,
      providerNoticeTitle: (businessName: string) => `Comunicazione di ${businessName}`,
      ics: {
        filename: 'appuntamento.ics',
        summary: (serviceName: string, businessName: string) =>
          `Appuntamento - ${serviceName} presso ${businessName}`,
        withMember: (memberName: string) => `Con ${memberName}`,
        atBusiness: (businessName: string) => `Presso ${businessName}`,
        cancelLine: (url: string) => `Per annullare: ${url}`,
      },
    },
  },

  loyalty: {
    fr: {
      cardTitle: (businessName: string) => `Votre carte de fidélité chez ${businessName}`,
      counted: (count: number, threshold: number, remaining: number, reward: string) =>
        `${count}/${threshold} RDV honorés — celui-ci s'ajoutera après votre venue. Plus que ${remaining} avant ${reward}.`,
      applied: (reward: string) => `Fidélité ${reward} appliquée sur ce rendez-vous.`,
      readyForNext: (reward: string) =>
        `Carte complète : ${reward} sur votre prochaine réservation dans l'app.`,
      // Email « récompense prête »
      rewardSubject: (businessName: string) => `Votre récompense est prête chez ${businessName}`,
      rewardTitle: 'Votre récompense est prête !',
      rewardBody: (businessName: string, reward: string) =>
        `Votre carte de fidélité chez ${businessName} est complète : ${reward} sera appliqué automatiquement sur votre prochaine réservation dans l'app.`,
      rewardCta: 'Réserver et utiliser ma réduction',
    },
    en: {
      cardTitle: (businessName: string) => `Your loyalty card at ${businessName}`,
      counted: (count: number, threshold: number, remaining: number, reward: string) =>
        `${count}/${threshold} completed appointments — this one will be added after your visit. Only ${remaining} left before ${reward}.`,
      applied: (reward: string) => `Loyalty ${reward} applied to this appointment.`,
      readyForNext: (reward: string) =>
        `Card complete: ${reward} off your next booking in the app.`,
      rewardSubject: (businessName: string) => `Your reward is ready at ${businessName}`,
      rewardTitle: 'Your reward is ready!',
      rewardBody: (businessName: string, reward: string) =>
        `Your loyalty card at ${businessName} is complete: ${reward} will be applied automatically to your next booking in the app.`,
      rewardCta: 'Book and use my reward',
    },
    it: {
      cardTitle: (businessName: string) => `La Sua carta fedeltà presso ${businessName}`,
      counted: (count: number, threshold: number, remaining: number, reward: string) =>
        `${count}/${threshold} appuntamenti effettuati — questo si aggiungerà dopo la Sua visita. Ne mancano solo ${remaining} per ottenere ${reward}.`,
      applied: (reward: string) => `Sconto fedeltà ${reward} applicato a questo appuntamento.`,
      readyForNext: (reward: string) =>
        `Carta completa: ${reward} sulla Sua prossima prenotazione nell'app.`,
      // Email « récompense prête »
      rewardSubject: (businessName: string) => `Il Suo premio è pronto presso ${businessName}`,
      rewardTitle: 'Il Suo premio è pronto!',
      rewardBody: (businessName: string, reward: string) =>
        `La Sua carta fedeltà presso ${businessName} è completa: ${reward} verrà applicato automaticamente alla Sua prossima prenotazione nell'app.`,
      rewardCta: 'Prenota e usa lo sconto',
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
    it: {
      subject: (serviceName: string) => `Conferma del Suo appuntamento - ${serviceName}`,
      subjectUpdated: (businessName: string) =>
        `Il Suo appuntamento è stato aggiornato - ${businessName}`,
      introHtml:
        'Il Suo appuntamento è stato <strong style="color: #16a34a;">confermato</strong>.',
      introText: 'Il Suo appuntamento è stato confermato.',
      updateAddedHtml: (serviceName: string) =>
        `Una prestazione è stata <strong style="color: #16a34a;">aggiunta al</strong> Suo appuntamento: <strong>${serviceName}</strong>.`,
      updateRemovedHtml: (serviceName: string) =>
        `Una prestazione è stata <strong style="color: #dc2626;">rimossa dal</strong> Suo appuntamento: <strong>${serviceName}</strong>.`,
      updateAddedText: (serviceName: string) =>
        `Una prestazione è stata aggiunta al Suo appuntamento: ${serviceName}.`,
      updateRemovedText: (serviceName: string) =>
        `Una prestazione è stata rimossa dal Suo appuntamento: ${serviceName}.`,
      updatedSub: 'Ecco il Suo appuntamento aggiornato.',
      boxTitleMulti: 'Le Sue prestazioni',
      boxTitleSingle: 'Il Suo appuntamento',
      detailsHeading: 'Dettagli del Suo appuntamento:',
      reviewFooterHtml: (url: string) =>
        `Dopo l'appuntamento, <a href="${url}" style="color: #6366f1; text-decoration: underline;">ci lasci una recensione</a>`,
      reviewFooterText: (url: string) => `Dopo l'appuntamento, ci lasci una recensione: ${url}`,
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
    it: {
      subject: (timeLabel: string, serviceName: string) =>
        `Promemoria: il Suo appuntamento ${timeLabel} - ${serviceName}`,
      introHtml: (timeLabel: string) =>
        `Le ricordiamo che il Suo appuntamento è previsto <strong style="color: #2563eb;">${timeLabel}</strong>.`,
      introText: (timeLabel: string) =>
        `Le ricordiamo che il Suo appuntamento è previsto ${timeLabel}.`,
      boxTitle: 'Promemoria appuntamento',
      detailsHeading: 'Dettagli del Suo appuntamento:',
      tomorrow: 'domani',
      inTwoDays: 'tra 2 giorni',
      inTwoHours: 'tra 2 ore',
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
    it: {
      subject: (serviceName: string) => `Annullamento del Suo appuntamento - ${serviceName}`,
      introHtml:
        'La informiamo che il Suo appuntamento è stato <strong style="color: #dc2626;">annullato</strong>.',
      introText: 'La informiamo che il Suo appuntamento è stato annullato.',
      boxTitle: 'Appuntamento annullato',
      detailsHeading: "Dettagli dell'appuntamento annullato:",
      refundedTitle: '✓ Acconto rimborsato',
      refundedBodyHtml: (formattedAmount: string) =>
        `Il Suo acconto di <strong>${formattedAmount}</strong> è in fase di rimborso sul Suo metodo di pagamento. Sono necessari da 5 a 10 giorni lavorativi perché risulti visibile.`,
      refundedText: (formattedAmount: string) =>
        `✓ Il Suo acconto di ${formattedAmount} è in fase di rimborso (da 5 a 10 giorni lavorativi).`,
      unrefundedTitle: 'Acconto non rimborsato',
      unrefundedBodyHtml: (formattedAmount: string, businessName: string) =>
        `Il Suo acconto di <strong>${formattedAmount}</strong> non è rimborsabile perché la richiesta di annullamento è avvenuta dopo il termine di rimborso stabilito da ${businessName}.`,
      unrefundedContactHtml: (businessName: string) =>
        `Per qualsiasi richiesta eccezionale, contatti direttamente ${businessName}.`,
      unrefundedText: (formattedAmount: string, businessName: string) =>
        `⚠ Il Suo acconto di ${formattedAmount} non è rimborsabile perché la richiesta di annullamento è avvenuta dopo il termine stabilito da ${businessName}.`,
      rebookPromptHtml:
        'Se desidera fissare un nuovo appuntamento, non esiti a contattarci o a prenotare online.',
      rebookPromptText: (url: string) =>
        `Se desidera fissare un nuovo appuntamento, può prenotare online su ${url}`,
      apology: 'Ci scusiamo per il disagio.',
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
    it: {
      subject: (serviceName: string) => `Modifica del Suo appuntamento - ${serviceName}`,
      introHtml: 'Il Suo appuntamento è stato <strong style="color: #2563eb;">modificato</strong>.',
      introText: 'Il Suo appuntamento è stato modificato.',
      oldSlotTitle: 'Orario precedente',
      newSlotTitle: 'Nuovo orario',
      atJoiner: 'alle',
      oldSlotLineText: (formattedDate: string, formattedTime: string) =>
        `Orario precedente: ${formattedDate} alle ${formattedTime}`,
      newSlotHeadingText: 'Nuovo orario:',
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
    it: {
      subject: (serviceName: string) => `Com'è andato il Suo appuntamento? - ${serviceName}`,
      htmlLang: 'it',
      eyebrow: 'La Sua opinione conta',
      heading: "Com'è andato il Suo appuntamento?",
      body: 'Ci auguriamo che il Suo appuntamento sia andato bene. La Sua recensione aiuta altri clienti a scegliere e ci aiuta a migliorare i nostri servizi.',
      boxTitle: 'Il Suo appuntamento',
      boxTitleText: 'Il Suo appuntamento:',
      cta: 'Lascia una recensione',
      ctaLineText: 'Lasci qui la Sua recensione:',
      visibleNote: (providerName: string) =>
        `La Sua recensione sarà visibile sulla pagina di ${providerName}.`,
      sentBy: 'Email inviata da',
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
    it: {
      subject: (serviceName: string, providerName: string) =>
        `Acconto in attesa — ${serviceName} presso ${providerName}`,
      introHtml: (providerName: string) =>
        `Il Suo appuntamento presso <strong>${providerName}</strong> è <strong style="color: #d97706;">in attesa del pagamento dell'acconto</strong>.`,
      introText: (providerName: string) =>
        `Il Suo appuntamento presso ${providerName} è in attesa del pagamento dell'acconto.`,
      boxTitle: 'Appuntamento in attesa',
      deadlineHtml: (minutesLeft: number) =>
        `Se l'acconto non viene pagato entro <strong>${minutesLeft} minuti</strong>, il Suo posto verrà liberato automaticamente.`,
      deadlineText: (minutesLeft: number) =>
        `Se l'acconto non viene pagato entro ${minutesLeft} minuti, il Suo posto verrà liberato automaticamente.`,
      payCta: "Paga subito l'acconto",
      payLineText: (url: string) => `Paga l'acconto: ${url}`,
      cancelQuestionHtml: (url: string) =>
        `Non può presentarsi all'appuntamento? <a href="${url}" style="color: #dc2626; text-decoration: underline;">Annulla la prenotazione</a>.`,
      cancelLineText: (url: string) => `Annulla la prenotazione: ${url}`,
      signoff: 'A prestissimo,',
    },
  },
} as const;
