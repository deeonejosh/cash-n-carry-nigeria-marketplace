'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Room, Track } from 'livekit-client';

type Option = { id: string; title: string };
type Pinned = { pinnedProduct?: (Option & { slug: string }) | null; pinnedAuction?: Option | null };

async function action(input: Record<string, unknown>) {
  const response = await fetch('/api/live', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Livestream request failed.');
  return result;
}

export default function LiveRoom({ id, host, products, auctions }: { id: string; host: boolean; products: Option[]; auctions: Option[] }) {
  const room = useRef<Room | null>(null);
  const player = useRef<HTMLDivElement>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [moderate, setModerate] = useState(false);
  const [status, setStatus] = useState('');
  const [viewers, setViewers] = useState<{ id: string; name: string }[]>([]);
  const [messages, setMessages] = useState<{ name: string; text: string }[]>([]);
  const [pinned, setPinned] = useState<Pinned>({});
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      void room.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      void fetch(`/api/live?id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return;
          const current = (await response.json()).streams[0];
          setPinned(current ?? {});
          if (!current) {
            void room.current?.disconnect();
            setStatus('This livestream has ended.');
          }
        }).catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [id]);

  async function join() {
    setBusy(true);
    setStatus('');
    let next: Room | undefined;
    try {
      const [{ Room: LiveKitRoom, RoomEvent }, result] = await Promise.all([
        import('livekit-client'), action({ action: 'join', id, broadcast: host }),
      ]);
      if (disposed.current) return;
      next = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
      const connection = next;
      const updateViewers = () => setViewers(
        Array.from(connection.remoteParticipants.values())
          .filter((participant) => participant.identity.startsWith('viewer-'))
          .map((participant) => ({ id: participant.identity, name: participant.name || 'Viewer' })),
      );
      const attach = (track: Track, muted = false) => {
        const element = track.attach();
        element.muted = muted;
        element.className = 'max-h-[70vh] w-full rounded-xl object-contain';
        player.current?.append(element);
      };
      connection.on(RoomEvent.TrackSubscribed, (track) => attach(track));
      connection.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
      connection.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.track && publication.kind === 'video') attach(publication.track, true);
      });
      connection.on(RoomEvent.LocalTrackUnpublished, (publication) => publication.track?.detach().forEach((element) => element.remove()));
      connection.on(RoomEvent.ParticipantConnected, updateViewers);
      connection.on(RoomEvent.ParticipantDisconnected, updateViewers);
      connection.on(RoomEvent.DataReceived, (bytes, participant, _kind, topic) => {
        if (topic !== 'shopping-chat' || bytes.length > 2000) return;
        const text = new TextDecoder().decode(bytes).trim().slice(0, 400);
        if (text) setMessages((current) => [...current.slice(-49), { name: participant?.name || 'Viewer', text }]);
      });
      connection.on(RoomEvent.Disconnected, () => {
        setJoined(false); setCamera(false); setMic(false); setViewers([]);
        player.current?.replaceChildren();
      });
      room.current = connection;
      await connection.connect(result.url, result.token);
      if (disposed.current) { await connection.disconnect(); return; }
      setModerate(result.canModerate);
      updateViewers();
      setJoined(true);
    } catch (error) {
      await next?.disconnect().catch(() => {});
      setStatus(error instanceof Error ? error.message : 'Unable to connect.');
    } finally {
      setBusy(false);
    }
  }

  async function media(kind: 'camera' | 'microphone') {
    const connection = room.current;
    if (!connection) return;
    setBusy(true);
    setStatus('');
    try {
      if (kind === 'camera') { await connection.localParticipant.setCameraEnabled(!camera); setCamera(!camera); }
      else { await connection.localParticipant.setMicrophoneEnabled(!mic); setMic(!mic); }
    } catch {
      setStatus('Check device permissions and try again.');
    } finally { setBusy(false); }
  }

  async function chat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get('chat') ?? '').trim().slice(0, 400);
    if (!text || !room.current) return;
    try {
      await room.current.localParticipant.publishData(new TextEncoder().encode(text), { reliable: true, topic: 'shopping-chat' });
      setMessages((current) => [...current.slice(-49), { name: 'You', text }]);
      form.reset();
    } catch { setStatus('Unable to send chat message.'); }
  }

  async function control(input: Record<string, unknown>) {
    setBusy(true);
    setStatus('');
    try {
      await action({ id, ...input });
      if (input.action === 'end') { await room.current?.disconnect(); setStatus('Livestream ended.'); }
      else if (input.action === 'pin') setStatus('Pin updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update stream.');
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-4">
      <div ref={player} className="min-h-32 rounded-xl bg-slate-950" />
      {pinned.pinnedProduct && <Link href={`/products/${pinned.pinnedProduct.slug}`} className="block font-bold text-emerald-800">Shop {pinned.pinnedProduct.title}</Link>}
      {pinned.pinnedAuction && <Link href={`/auctions#${pinned.pinnedAuction.id}`} className="block font-bold text-emerald-800">Bid on {pinned.pinnedAuction.title}</Link>}
      {!joined ? <button disabled={busy} onClick={join} className="rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">{host ? 'Connect as broadcaster' : 'Join livestream'}</button> : (
        <>
          <p>{viewers.length + (host ? 0 : 1)} connected viewers</p>
          <div className="flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
            {host && <>
              <button disabled={busy} onClick={() => media('camera')}>{camera ? 'Turn camera off' : 'Turn camera on'}</button>
              <button disabled={busy} onClick={() => media('microphone')}>{mic ? 'Mute microphone' : 'Unmute microphone'}</button>
            </>}
            <button onClick={() => room.current?.startAudio().catch(() => setStatus('Audio could not start.'))}>Enable audio playback</button>
            <button onClick={() => room.current?.disconnect()}>Leave room</button>
            {moderate && <button disabled={busy} onClick={() => control({ action: 'end' })} className="text-red-700">End stream</button>}
          </div>
          {host && <form className="flex flex-wrap gap-3" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void control({ action: 'pin', productId: form.get('product') || null, auctionId: form.get('auction') || null });
          }}>
            <label>Pin product <select name="product"><option value="">None</option>{products.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>Pin auction <select name="auction"><option value="">None</option>{auctions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <button disabled={busy} className="font-bold text-emerald-800">Update pins</button>
          </form>}
          {moderate && viewers.map((viewer) => (
            <button key={viewer.id} disabled={busy} onClick={() => control({ action: 'remove', identity: viewer.id })} className="mr-3 text-sm font-bold text-red-700">Remove {viewer.name}</button>
          ))}
          <ul className="max-h-48 overflow-auto">{messages.map((message, index) => <li key={index}><strong>{message.name}</strong> {message.text}</li>)}</ul>
          <form onSubmit={chat} className="flex gap-3"><input name="chat" aria-label="Live chat" required maxLength={400} className="min-w-0 flex-1 rounded-xl border p-2" /><button className="font-bold text-emerald-800">Send</button></form>
        </>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
