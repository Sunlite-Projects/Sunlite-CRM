import { useState, useEffect, useMemo, useRef } from 'react';
import { Link2, Plus, Copy, Check, Trash2, QrCode, Download, ExternalLink, X } from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { fetchShortLinks, createShortLink, deleteShortLink, shortLinkUrl, type ShortLink } from '../api/sheets';

function last7Days(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    out.push(day.toISOString().split('T')[0]);
  }
  return out;
}

function Sparkline({ daily }: { daily: Record<string, number> }) {
  const days = last7Days();
  const vals = days.map(d => daily[d] ?? 0);
  const max = Math.max(1, ...vals);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {vals.map((v, i) => (
        <div
          key={i}
          title={`${days[i]}: ${v}`}
          className="w-2 rounded-sm bg-amber-400"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v === 0 ? 0.25 : 1 }}
        />
      ))}
    </div>
  );
}

function QrModal({ link, onClose }: { link: ShortLink; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = shortLinkUrl(link.slug);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 260, margin: 2, color: { dark: '#0F2A4A', light: '#ffffff' } });
    }
  }, [url]);

  const downloadPng = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `qr-${link.slug}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-black text-gray-800 uppercase tracking-wider">QR Code</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex justify-center mb-3">
          <canvas ref={canvasRef} className="rounded-xl border border-gray-100" />
        </div>
        <p className="text-xs font-bold text-gray-700">{link.label || link.slug}</p>
        <p className="text-[11px] text-gray-400 break-all mb-4">{url}</p>
        <button onClick={downloadPng} className="w-full flex items-center justify-center gap-2 bg-[#0F2A4A] hover:bg-[#1a3a5c] text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
          <Download size={15} /> Download PNG for flyer
        </button>
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
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<ShortLink | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchShortLinks().catch(() => []);
    setLinks(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totalClicks = useMemo(() => links.reduce((s, l) => s + l.clicks, 0), [links]);

  const handleCreate = async () => {
    if (!destination.trim()) { toast.error('Enter a destination URL'); return; }
    setSaving(true);
    const res = await createShortLink({
      slug: slug.trim(),
      destination: destination.trim(),
      label: label.trim(),
      createdBy: currentUser?.name ?? currentUser?.email ?? '',
    });
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Link created');
    setSlug(''); setDestination(''); setLabel(''); setShowForm(false);
    load();
  };

  const handleDelete = async (l: ShortLink) => {
    if (!confirm(`Delete "${l.label || l.slug}"? This can't be undone.`)) return;
    setLinks(prev => prev.filter(x => x.slug !== l.slug));
    await deleteShortLink(l.slug).catch(() => {});
    toast.success('Deleted');
  };

  const copy = (l: ShortLink) => {
    navigator.clipboard.writeText(shortLinkUrl(l.slug));
    setCopied(l.slug);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-amber-500" />
            <h1 className="text-lg font-black text-gray-900">Marketing Links</h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Trackable short links & QR codes for flyers and campaigns</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-[#0F2A4A] hover:bg-[#1a3a5c] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> New Link
          </button>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Links</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{links.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Clicks</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{totalClicks}</p>
        </div>
      </div>

      {/* Create form */}
      {canManage && showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-black text-gray-800 uppercase tracking-wider">New Short Link</p>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destination URL *</label>
            <input value={destination} onChange={e => setDestination(e.target.value)}
              placeholder="https://sunlite.com/product-catalogs"
              className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Campaign / Label</label>
              <input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="Spring 2026 Flyer"
                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Custom slug (optional)</label>
              <input value={slug} onChange={e => setSlug(e.target.value)}
                placeholder="spring24"
                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 font-mono" />
            </div>
          </div>
          {slug && <p className="text-[11px] text-gray-400">Link will be <span className="font-mono text-gray-600">{shortLinkUrl(slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}</span></p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-[#0F2A4A] hover:bg-[#1a3a5c] disabled:bg-gray-300 text-white text-sm font-bold py-2 rounded-lg transition-colors">
              {saving ? 'Creating…' : 'Create Link'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Link2 size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-700">No links yet</p>
          <p className="text-xs text-gray-400 mt-1">{canManage ? 'Create your first trackable link for a flyer.' : 'No marketing links have been created yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(l => (
            <div key={l.slug} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{l.label || l.slug}</p>
                    <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">/go/{l.slug}</span>
                  </div>
                  <a href={l.destination} target="_blank" rel="noreferrer"
                    className="text-xs text-gray-400 hover:text-amber-600 truncate flex items-center gap-1 mt-0.5 max-w-full">
                    <ExternalLink size={10} className="flex-shrink-0" />
                    <span className="truncate">{l.destination}</span>
                  </a>
                  {l.createdBy && <p className="text-[10px] text-gray-300 mt-1">by {l.createdBy}</p>}
                </div>

                {/* Clicks + sparkline */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-2xl font-black text-gray-900 leading-none">{l.clicks}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">clicks</p>
                  <div className="mt-1 flex justify-end"><Sparkline daily={l.daily} /></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => copy(l)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
                  {copied === l.slug ? <><Check size={12} className="text-green-500" /> Copied</> : <><Copy size={12} /> Copy link</>}
                </button>
                <button onClick={() => setQrLink(l)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
                  <QrCode size={12} /> QR code
                </button>
                {canManage && (
                  <button onClick={() => handleDelete(l)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {qrLink && <QrModal link={qrLink} onClose={() => setQrLink(null)} />}
    </div>
  );
}
