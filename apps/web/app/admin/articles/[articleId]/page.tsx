'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminArticleService,
  type ArticleDetail,
} from '@/services/admin/adminArticleService';
import { ArticleEditor } from '../components/ArticleEditor';

export default function EditArticlePage() {
  const params = useParams<{ articleId: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !params?.articleId) return;
    setLoading(true);
    setError(null);
    adminArticleService
      .get(user.id, params.articleId)
      .then(setArticle)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur inconnue'))
      .finally(() => setLoading(false));
  }, [user?.id, params?.articleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>{error || 'Article introuvable'}</p>
      </div>
    );
  }

  return <ArticleEditor initial={article} />;
}
