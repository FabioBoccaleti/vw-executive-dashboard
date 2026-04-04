import { useState, useEffect } from 'react';
import { Pencil, X } from 'lucide-react';
import { kvGet, kvSet } from '@/lib/kvClient';
import { useAuth } from '@/contexts/useAuth';

interface BaseDateBadgeProps {
  dateKey: string;
}

export function BaseDateBadge({ dateKey }: BaseDateBadgeProps) {
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  const [value, setValue] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    kvGet<string>(dateKey).then(v => {
      setValue(v);
      setInput(v || '');
      setLoaded(true);
    });
  }, [dateKey]);

  if (!loaded) return null;
  if (!admin && !value) return null;

  function formatDate(dateStr: string) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year.slice(2)}`;
  }

  async function handleSave() {
    if (!input) return;
    setSaving(true);
    await kvSet(dateKey, input);
    setValue(input);
    setSaving(false);
    setEditing(false);
  }

  function handleStopProp(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div className="mt-1" onClick={handleStopProp}>
      {editing ? (
        <div className="flex items-center gap-1 justify-center flex-wrap">
          <input
            type="date"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="text-xs border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <span
            role="button"
            tabIndex={0}
            aria-disabled={saving || !input}
            onClick={!saving && input ? handleSave : undefined}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !saving && input && handleSave()}
            className={`text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 transition-colors cursor-pointer ${saving || !input ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {saving ? '...' : 'Salvar'}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={() => { setEditing(false); setInput(value || ''); }}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (setEditing(false), setInput(value || ''))}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1 justify-center">
          <span className="text-xs text-red-500 font-medium">
            {value ? `Data da Base: ${formatDate(value)}` : 'Definir Data da Base'}
          </span>
          {admin && (
            <span
              role="button"
              tabIndex={0}
              onClick={() => { setInput(value || ''); setEditing(true); }}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (setInput(value || ''), setEditing(true))}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Editar data da base"
            >
              <Pencil className="w-3 h-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
