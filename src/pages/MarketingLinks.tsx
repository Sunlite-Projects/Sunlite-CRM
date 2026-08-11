import { useState, useEffect, useMemo, useRef } from 'react';
import { Link2, Plus, Copy, Check, Trash2, QrCode, Download, ExternalLink, X, Power } from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import {
  fetchShortLinks, createShortLink, updateShortLink, deleteShortLink,
  shortLinkUrl, type ShortLink,
} from '../api/sheets';

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    out.push(day.toISOString().split('T')[0]);
  }
  return out;
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '—';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function BreakdownBars({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (entries.length === 0) return <p className="text-xs text-gray-300 py-2">No data yet</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => {
        const pct = total ? Math.round((v / total) * 100) : 0;
        return (
          <div key={k} className="relative bg-gray-50 rounded-lg overflow-hidden h-7 flex items-center px-2.5">
            <div className="absolute inset-y-0 left-0 rounded-lg opacity-30" style={{ width: `${pct}%`, background: color }} />
            <span className="relative text-[11px] font-semibold text-gray-700 truncate flex-1">{k}</span>
            <span className="relative text-[11px] font-bold text-gray-500 ml-2">{v} · {pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ClickChart({ daily }: { daily: Record<string, number> }) {
  const days = lastNDays(30);
  const vals = days.map(d => daily[d] ?? 0);
  const max = Math.max(1, ...vals);
  return (
    <div>
      <div className="flex items-end gap-0.5 h-24">
        {vals.map((v, i) => (
          <div key={i} title={`${days[i]}: ${v}`} className="flex-1 rounded-sm bg-amber-400 transition-all hover:bg-amber-500"
            style={{ height: `${Math.max(3, (v / max) * 100)}%`, opacity: v === 0 ? 0.2 : 1 }} />
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-300">{days[0]}</span>
        <span className="text-[10px] text-gray-300">{days[days.length - 1]}</span>
      </div>
    </div>
  );
}

function LinkDetailModal({ link, canManage, onClose, onChanged }: {
  link: ShortLink; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const url = shortLinkUrl(link.slug);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState(link.label);
  const [campaign, setCampaign] = useState(link.campaign);
  const [destination, setDestination] = useState(link.destination);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 150, margin: 1, color: { dark: '#0F2A4A', light: '#ffffff' } });
    }
  }, [url]);

  const created = link.createdDate ? new Date(link.createdDate) : null;
  const dirty = label !== link.label || campaign !== link.campaign || destination !== link.destination;

  const save = async () => {
    setSaving(true);
    const res = await updateShortLink(link.slug, { label, campaign, destination });
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Saved');
    onChanged();
  };

  const toggleActive = async () => {
    await updateShortLink(link.slug, { active: link.active ? 'false' : 'true' });
    toast.success(link.active ? 'Link switched off' : 'Link is live');
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete "${link.label || link.slug}"? This can't be undone.`)) return;
    await deleteShortLink(link.slug).catch(() => {});
    toast.success('Deleted');
    onChanged();
    onClose();
  };

  const downloadPng = () => {
    if (!canvasRef.current) return;
    QRCode.toDataURL(url, { width: 600, margin: 2, color: { dark: '#0F2A4A', light: '#ffffff' } }).then(d => {
      const a = document.createElement('a');
      a.href = d; a.download = `qr-${link.slug}.png`; a.click();
    });
  };

  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-4" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-lg font-black text-gray-900 truncate">{link.label || link.slug}</p>
            {link.campaign && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{link.campaign}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* URL bar */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${link.active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-xs font-semibold text-gray-700 truncate flex-1">{url}</span>
            <button onClick={copy} className="text-[11px] font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 flex-shrink-0">
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Clicks', value: link.clicks, sub: 'total' },
              { label: 'People', value: link.uniqueVisitors, sub: 'unique' },
              { label: 'Last click', value: timeAgo(link.lastClick), sub: '', small: true },
              { label: 'Created', value: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', sub: link.createdBy, small: true },
            ].map(t => (
              <div key={t.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{t.label}</p>
                <p className={`font-black text-gray-900 ${t.small ? 'text-sm mt-1' : 'text-2xl'}`}>{t.value}</p>
                {t.sub && <p className="text-[9px] text-gray-400 truncate mt-0.5">{t.sub}</p>}
              </div>
            ))}
          </div>

          {/* 30-day chart */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Clicks — Last 30 Days</p>
            <ClickChart daily={link.daily} />
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Where they came from</p>
              <BreakdownBars data={link.referrer} color="#f59e0b" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Device</p>
              <BreakdownBars data={link.device} color="#2563eb" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Town</p>
              <BreakdownBars data={link.city} color="#16a34a" />
            </div>
          </div>

          {/* QR */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
            <canvas ref={canvasRef} className="rounded-lg border border-gray-100 bg-white flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800">QR code</p>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">Scans count as clicks. Print it on signs, cards or truck decals — you can repoint the link later without reprinting anything.</p>
              <button onClick={downloadPng} className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#0F2A4A] hover:bg-[#1a3a5c] px-3 py-1.5 rounded-lg transition-colors">
                <Download size={12} /> Download PNG
              </button>
            </div>
          </div>

          {/* Edit (admin/owner) */}
          {canManage && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Label</label>
                  <input value={label} onChange={e => setLabel(e.target.value)} className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Campaign</label>
                  <input value={campaign} onChange={e => setCampaign(e.target.value)} className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Destination</label>
                <input value={destination} onChange={e => setDestination(e.target.value)} className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 font-mono" />
              </div>
              <p className="text-[11px] text-gray-400">Changing the destination repoints every copy of this link — printed ones included. Clicks already recorded are kept.</p>
              {dirty && (
                <button onClick={save} disabled={saving} className="bg-[#0F2A4A] hover:bg-[#1a3a5c] disabled:bg-gray-300 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canManage && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button onClick={toggleActive} className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
              <Power size={13} /> {link.active ? 'Switch off' : 'Switch on'}
            </button>
            <button onClick={del} className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketingLinks() {
  const { currentUser } = useAuthStore();
  const role = currentUser?.role ?? 'field_sales';
  const canManage = role === 'admin' || role === 'owner';

  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState('');
  const [destination, setDestination] = useState('');
  const [label, setLabel] = useState('');
  const [campaign, setCampaign] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ShortLink | null>(null);

  const load = async () => {
    const data = await fetchShortLinks().catch(() => []);
    setLinks(data);
    setLoading(false);
    // keep an open detail modal in sync
    setDetail(prev => prev ? data.find(l => l.slug === prev.slug) ?? null : null);
  };
  useEffect(() => { load(); }, []);

  const totalClicks = useMemo(() => links.reduce((s, l) => s + l.clicks, 0), [links]);

  const handleCreate = async () => {
    if (!destination.trim()) { toast.error('Enter a destination URL'); return; }
    setSaving(true);
    const res = await createShortLink({
      slug: slug.trim(), destination: destination.trim(), label: label.trim(),
      campaign: campaign.trim(), createdBy: currentUser?.name ?? currentUser?.email ?? '',
    });
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Link created');
    setSlug(''); setDestination(''); setLabel(''); setCampaign(''); setShowForm(false);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-amber-500" />
            <h1 className="text-lg font-black text-gray-900">Marketing Links</h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Trackable short links & QR codes for flyers and campaigns</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-[#0F2A4A] hover:bg-[#1a3a5c] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <Plus size={15} /> New Link
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Links</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{links.filter(l => l.active).length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Clicks</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{totalClicks}</p>
        </div>
      </div>

      {canManage && showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-black text-gray-800 uppercase tracking-wider">New Short Link</p>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destination URL *</label>
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="https://sunlite.com/product-catalogs"
              className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Label</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="WhatsApp status link"
                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Campaign</label>
              <input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Summer 2026"
                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Slug (optional)</label>
              <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="summer24"
                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 font-mono" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving} className="flex-1 bg-[#0F2A4A] hover:bg-[#1a3a5c] disabled:bg-gray-300 text-white text-sm font-bold py-2 rounded-lg transition-colors">
              {saving ? 'Creating…' : 'Create Link'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Link2 size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-700">No links yet</p>
          <p className="text-xs text-gray-400 mt-1">{canManage ? 'Create your first trackable link for a flyer.' : 'No marketing links have been created yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map(l => (
            <button key={l.slug} onClick={() => setDetail(l)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-amber-300 transition-all text-left">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.active ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">{l.label || l.slug}</p>
                  <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">/go/{l.slug}</span>
                  {l.campaign && <span className="text-[9px] font-bold text-gray-400 uppercase">{l.campaign}</span>}
                </div>
                <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                  <ExternalLink size={10} /> {l.destination}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xl font-black text-gray-900 leading-none">{l.clicks}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase">clicks</p>
              </div>
              <QrCode size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {detail && <LinkDetailModal link={detail} canManage={canManage} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
  );
}
