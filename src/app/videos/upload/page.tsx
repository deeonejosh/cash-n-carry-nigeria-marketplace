'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

type Product = { id: string; title: string };

export default function UploadVideo() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [postId, setPostId] = useState('');

  useEffect(() => {
    fetch('/api/products').then(async (response) => {
      if (response.ok) setProducts((await response.json()).products);
    }).catch(() => {});
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const video = data.get('video');
    if (!(video instanceof File) || video.size === 0 || video.size > 20 * 1024 * 1024) {
      setStatus('Choose an MP4 up to 20 MB.');
      return;
    }
    const query = new URLSearchParams({ title: String(data.get('title')), productId: String(data.get('productId')) });
    setBusy(true);
    setStatus('');
    setPostId('');
    try {
      const response = await fetch(`/api/videos?${query}`, {
        method: 'POST', headers: { 'content-type': 'video/mp4' }, body: video,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to upload a video.' : result.error);
      setPostId(result.id);
      setStatus('Video published.');
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Upload a video</h1>
      <form onSubmit={upload} className="grid gap-3 rounded-2xl border bg-white p-4">
        <label>Title<input name="title" required maxLength={120} className="block w-full rounded-xl border p-2" /></label>
        <label>MP4 video (up to 20 MB)<input name="video" type="file" required accept="video/mp4" className="block w-full" /></label>
        <label>Tag a product<select name="productId" className="block w-full rounded-xl border p-2">
          <option value="">No product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select></label>
        <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Publish video</button>
      </form>
      {status && <p role="status">{status}</p>}
      {postId && <Link className="font-bold text-emerald-800" href={`/videos#${postId}`}>Watch your video</Link>}
    </main>
  );
}
