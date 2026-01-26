import { Resend } from 'resend';

// Lazy singleton instance of Resend client (initialized on first use, not at build time)
let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// For backward compatibility - use getResend() for new code
export const resend = {
  emails: {
    send: async (...args: Parameters<Resend['emails']['send']>) => {
      return getResend().emails.send(...args);
    },
  },
};

// Email configuration
export const emailConfig = {
  from: 'Opatam <noreply@kamerleontech.com>',
  replyTo: 'support@kamerleontech.com',
} as const;

// App configuration
export const appConfig = {
  name: 'Opatam',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.vercel.app',
} as const;

// Helper to format date in French
export function formatDateFr(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Helper to format time in French
export function formatTimeFr(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to format price (centimes to euros)
export function formatPriceFr(priceInCentimes: number): string {
  const priceInEuros = priceInCentimes / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInEuros);
}

// Email footer HTML
export function getEmailFooterHtml(businessName: string): string {
  return `
    <!-- Footer -->
    <tr>
      <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
        <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
          A bientot,<br>
          <strong>${businessName}</strong>
        </p>
      </td>
    </tr>
  `;
}

// Email wrapper HTML
export function getEmailWrapperHtml(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                    ${appConfig.name}
                  </h1>
                </td>
              </tr>
              ${content}
            </table>
            <!-- Disclaimer -->
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
              Cet email a ete envoye automatiquement par ${appConfig.name}.<br>
              Si vous n'etes pas concerne, veuillez ignorer ce message.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
