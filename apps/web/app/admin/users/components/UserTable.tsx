'use client';

import { ChevronRight, ShieldCheck, Ban } from 'lucide-react';
import { Badge } from '@/components/ui';

interface UserItem {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  photoURL: string | null;
  role: string;
  isAdmin: boolean;
  isDisabled: boolean;
  createdAt: string | null;
}

interface UserTableProps {
  items: UserItem[];
  onUserClick: (userId: string) => void;
}

const roleLabels: Record<string, string> = {
  client: 'Client',
  provider: 'Prestataire',
  both: 'Client + Pro',
};

const roleBadgeVariant: Record<string, 'info' | 'success' | 'warning'> = {
  client: 'info',
  provider: 'success',
  both: 'warning',
};

export function UserTable({ items, onUserClick }: UserTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
        Aucun utilisateur trouvé
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Utilisateur
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Rôle
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date d&apos;inscription
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Statut
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr
                key={user.id}
                onClick={() => onUserClick(user.id)}
                className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {user.displayName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        {user.displayName}
                        {user.isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-red-500" />}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={roleBadgeVariant[user.role] || 'primary'} size="sm">
                    {roleLabels[user.role] || user.role}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-'}
                </td>
                <td className="px-5 py-3">
                  {user.isDisabled ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                      <Ban className="w-3 h-3" /> Désactivé
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-500">Actif</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="p-1.5 rounded-lg inline-flex">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((user) => (
          <div
            key={user.id}
            onClick={() => onUserClick(user.id)}
            className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {user.displayName?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                  {user.displayName}
                  {user.isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-red-500" />}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={roleBadgeVariant[user.role] || 'primary'} size="sm">
                  {roleLabels[user.role] || user.role}
                </Badge>
                {user.isDisabled && (
                  <span className="text-xs text-red-500 font-medium">Désactivé</span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
