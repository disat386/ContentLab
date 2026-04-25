import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export interface WordPressSite {
  id: string;
  userId: string;
  name?: string;
  siteUrl: string; // Corrected field name
  username: string;
  appPassword: string;
  createdAt: unknown;
}

export interface WordPressPublishOptions {
  title: string;
  content: string;
  status: 'publish' | 'draft' | 'future';
  date?: string; // ISO string for scheduling
  categories?: number[];
  tags?: string[];
  featured_media?: number;
}

export const wordPressService = {
  async getSites(userId: string): Promise<WordPressSite[]> {
    const q = query(collection(db, 'wpConnections'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WordPressSite));
  },

  async publishPost(site: WordPressSite, options: WordPressPublishOptions) {
    // WordPress Basic Auth using Application Passwords
    const authString = btoa(`${site.username}:${site.appPassword}`);
    
    // Ensure URL is clean and ends with wp-json/wp/v2/posts
    const baseUrl = site.siteUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      body: JSON.stringify({
        title: options.title,
        content: options.content,
        status: options.status,
        date: options.date,
        categories: options.categories,
        tags: options.tags
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to publish to WordPress');
    }

    return await response.json();
  }
};
