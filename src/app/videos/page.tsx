'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Post = {
  id: string; title: string; videoUrl: string; creator: string; own: boolean; followed: boolean; liked: boolean; likes: number; commentsCount: number;
  product: { title: string; slug: string } | null;
  comments: { id: string; text: string; user: { name: string } }[];
};

export default function VideoFeed() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/videos', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load videos.');
    setPosts((await response.json()).posts);
  }, []);
  useEffect(() => { void load().catch(() => setStatus('Unable to load videos.')); }, [load]);

  async function react(id: string, action: string, text?: string) {
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/videos', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action, text }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to interact with videos.' : 'Unable to update video.');
      await load();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update video.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function comment(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await react(id, 'comment', String(new FormData(form).get('text')))) form.reset();
  }

  async function share(id: string) {
    try {
      await navigator.clipboard.writeText(new URL(`/videos#${id}`, window.location.origin).href);
      setStatus('Video link copied.');
    } catch {
      setStatus('Unable to copy link.');
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-5">
      <h1 className="text-3xl font-black text-emerald-950">For You videos</h1>
      <Link href="/videos/upload" className="font-bold text-emerald-800">Upload video</Link>
      {status && <p role="status">{status}</p>}
      {posts === null && !status && <p>Loading videos…</p>}
      {posts?.length === 0 && <p>No videos published yet.</p>}
      {posts?.map((post) => (
        <article key={post.id} id={post.id} className="space-y-3 rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-bold">{post.title}</h2>
          <p>{post.creator}</p>
          <video src={post.videoUrl} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] max-h-[65vh] max-w-full rounded-xl bg-slate-950" />
          {post.product && <Link href={`/products/${post.product.slug}`} className="font-bold text-emerald-800">Shop {post.product.title}</Link>}
          <div className="flex flex-wrap gap-4 text-sm font-bold text-emerald-800">
            <button disabled={busy || post.liked} onClick={() => react(post.id, 'like')}>{post.liked ? 'Liked' : 'Like'} · {post.likes}</button>
            {!post.own && <button disabled={busy || post.followed} onClick={() => react(post.id, 'follow')}>{post.followed ? 'Following' : 'Follow'}</button>}
            <button onClick={() => share(post.id)}>Copy video link</button>
          </div>
          <p className="text-sm font-bold">Comments · {post.commentsCount}</p>
          {post.comments.map((item) => <p key={item.id} className="text-sm"><strong>{item.user.name}</strong> {item.text}</p>)}
          <form onSubmit={(event) => comment(event, post.id)} className="flex flex-wrap items-center gap-2">
            <label>Comment<input name="text" required maxLength={500} className="ml-2 rounded-xl border p-2" /></label>
            <button disabled={busy} className="font-bold text-emerald-800">Post</button>
          </form>
        </article>
      ))}
    </main>
  );
}
