'use client';

import { Card, CardBody } from '../ui/Card';

interface WorkingHours {
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
}

interface ProviderInfoProps {
  address: string;
  city: string;
  postalCode: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  workingHours?: WorkingHours[];
  className?: string;
}

const defaultWorkingHours: WorkingHours[] = [
  { day: 'Lundi', open: '09:00', close: '18:00' },
  { day: 'Mardi', open: '09:00', close: '18:00' },
  { day: 'Mercredi', open: '09:00', close: '18:00' },
  { day: 'Jeudi', open: '09:00', close: '18:00' },
  { day: 'Vendredi', open: '09:00', close: '18:00' },
  { day: 'Samedi', open: '09:00', close: '13:00' },
  { day: 'Dimanche', open: '', close: '', isClosed: true },
];

function getTodayStatus(workingHours: WorkingHours[]): { isOpen: boolean; text: string } {
  const now = new Date();
  const dayIndex = now.getDay();
  const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayName = frenchDays[dayIndex];

  const today = workingHours.find((h) => h.day === todayName);
  if (!today || today.isClosed) {
    return { isOpen: false, text: 'Fermé aujourd\'hui' };
  }

  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const isOpen = currentTime >= today.open && currentTime < today.close;

  if (isOpen) {
    return { isOpen: true, text: `Ouvert jusqu'à ${today.close}` };
  } else if (currentTime < today.open) {
    return { isOpen: false, text: `Ouvre à ${today.open}` };
  } else {
    return { isOpen: false, text: 'Fermé' };
  }
}

export function ProviderInfo({
  address,
  city,
  postalCode,
  phone,
  email,
  website,
  workingHours = defaultWorkingHours,
  className = '',
}: ProviderInfoProps) {
  const todayStatus = getTodayStatus(workingHours);
  const hasStreetAddress = !!address?.trim();
  const fullAddress = hasStreetAddress
    ? `${address}, ${postalCode} ${city}`
    : `${postalCode} ${city}`;

  return (
    <Card variant="bordered" className={className}>
      <CardBody className="space-y-6">
        {/* Address */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Adresse</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{fullAddress}</p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Voir sur la carte
            </a>
          </div>
        </div>

        {/* Phone */}
        {phone && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Téléphone</h3>
              <a href={`tel:${phone}`} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                {phone}
              </a>
            </div>
          </div>
        )}

        {/* Email */}
        {email && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email</h3>
              <a href={`mailto:${email}`} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                {email}
              </a>
            </div>
          </div>
        )}

        {/* Website */}
        {website && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Site web</h3>
              <a href={website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                {website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          </div>
        )}

        {/* Working Hours */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Horaires</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                todayStatus.isOpen
                  ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {todayStatus.text}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {workingHours.map((hours) => (
                <div key={hours.day} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{hours.day}</span>
                  <span className={hours.isClosed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}>
                    {hours.isClosed ? 'Fermé' : `${hours.open} - ${hours.close}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
