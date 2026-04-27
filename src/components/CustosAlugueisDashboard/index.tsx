import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Pencil, Trash2, X, Check, AlertTriangle,
  Calendar, DollarSign, Home, ChevronRight, Layers, Printer,
} from 'lucide-react';
import { kvGet, kvSet } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Empresa = 'audi' | 'vw';

export interface ContratoAluguel {
  id: string;
  empresa: Empresa;
  local: string;
  proprietario: string;
  condominio: number;
  valorMensal: number;
  iptuAnual: number;
  utilizacaoRateio: string;
  dataRenovacao: string; // ISO yyyy-MM-dd
  observacoes: string;
}

const STORAGE_KEY = 'custos_alugueis:contratos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const parseNum = (s: string) =>
  parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;

function formatDateBR(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function diasParaRenovacao(iso: string): number {
  if (!iso) return Infinity;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + 'T00:00:00');
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

function RenovacaoBadge({ iso }: { iso: string }) {
  const dias = diasParaRenovacao(iso);
  if (!iso) return <span className="text-slate-400 text-xs">—</span>;
  if (dias < 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
        <AlertTriangle className="w-3 h-3" /> Vencido
      </span>
    );
  if (dias <= 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
        <AlertTriangle className="w-3 h-3" /> {formatDateBR(iso)}
      </span>
    );
  if (dias <= 90)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
        <Calendar className="w-3 h-3" /> {formatDateBR(iso)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Check className="w-3 h-3" /> {formatDateBR(iso)}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const EMPTY: Omit<ContratoAluguel, 'id'> = {
  empresa: 'vw',
  local: '',
  proprietario: '',
  condominio: 0,
  valorMensal: 0,
  iptuAnual: 0,
  utilizacaoRateio: '',
  dataRenovacao: '',
  observacoes: '',
};

function InputField({
  label, value, onChange, type = 'text', placeholder = '', required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
      />
    </div>
  );
}

function ContratoModal({
  initial, onSave, onCancel,
}: {
  initial: Partial<ContratoAluguel> & { empresa: Empresa };
  onSave: (data: Omit<ContratoAluguel, 'id'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<ContratoAluguel, 'id'>>({
    ...EMPTY,
    ...initial,
    valorMensal: initial.valorMensal ?? 0,
    iptuAnual: initial.iptuAnual ?? 0,
  });

  const set = (k: keyof typeof form) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const fmtInput = (v: number) =>
    v === 0 ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const isEdit = !!initial.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Home className="w-5 h-5" />
            <span className="font-bold text-sm">
              {isEdit ? 'Editar Contrato' : 'Novo Contrato de Aluguel'}
            </span>
          </div>
          <button onClick={onCancel} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Empresa *</label>
            <div className="flex gap-2">
              {(['audi', 'vw'] as Empresa[]).map(emp => (
                <button
                  key={emp}
                  onClick={() => setForm(p => ({ ...p, empresa: emp }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                    form.empresa === emp
                      ? emp === 'audi'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-blue-800 border-blue-800 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {emp === 'audi' ? 'Audi' : 'VW'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Local" value={form.local} onChange={set('local')} required placeholder="Ex: Estacionamento Rua X" />
            <InputField label="Proprietário" value={form.proprietario} onChange={set('proprietario')} placeholder="Nome do proprietário" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Condomínio</label>
              <input
                type="text"
                value={fmtInput(form.condominio)}
                onChange={e => setForm(p => ({ ...p, condominio: parseNum(e.target.value) }))}
                placeholder="0,00"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
              />
            </div>
            <InputField label="Utilização / Rateio" value={form.utilizacaoRateio} onChange={set('utilizacaoRateio')} placeholder="Ex: 100% VW, Administrativo" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Valor Mensal *</label>
              <input
                type="text"
                value={fmtInput(form.valorMensal)}
                onChange={e => setForm(p => ({ ...p, valorMensal: parseNum(e.target.value) }))}
                placeholder="0,00"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">IPTU Anual</label>
              <input
                type="text"
                value={fmtInput(form.iptuAnual)}
                onChange={e => setForm(p => ({ ...p, iptuAnual: parseNum(e.target.value) }))}
                placeholder="0,00"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
              />
            </div>
            <InputField
              label="Data de Renovação"
              value={form.dataRenovacao}
              onChange={set('dataRenovacao')}
              type="date"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              rows={3}
              placeholder="Anotações adicionais sobre o contrato..."
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.local.trim() || form.valorMensal <= 0) return;
              onSave(form);
            }}
            disabled={!form.local.trim() || form.valorMensal <= 0}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEdit ? 'Salvar Alterações' : 'Adicionar Contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

function TabelaContratos({
  contratos, readOnly, onEdit, onDelete,
}: {
  contratos: ContratoAluguel[];
  readOnly?: boolean;
  onEdit?: (c: ContratoAluguel) => void;
  onDelete?: (id: string) => void;
}) {
  if (contratos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <Home className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Nenhum contrato cadastrado</p>
        {!readOnly && <p className="text-xs text-slate-400">Clique em "Novo Contrato" para começar</p>}
      </div>
    );
  }

  const totalMensal      = contratos.reduce((s, c) => s + c.valorMensal, 0);
  const totalCondominio  = contratos.reduce((s, c) => s + (Number(c.condominio) || 0), 0);
  const totalIptuAnual   = contratos.reduce((s, c) => s + c.iptuAnual, 0);
  const totalIptuMes     = totalIptuAnual / 12;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
            {!readOnly && <th className="px-4 py-3 text-left rounded-tl-lg font-bold">Empresa</th>}
            <th className={`px-4 py-3 text-left font-bold ${readOnly ? 'rounded-tl-lg' : ''}`}>Local</th>
            <th className="px-4 py-3 text-left font-bold">Proprietário</th>
            <th className="px-4 py-3 text-right font-bold">Valor Mensal</th>
            <th className="px-4 py-3 text-left font-bold">Condomínio</th>
            <th className="px-4 py-3 text-right font-bold">IPTU Anual</th>
            <th className="px-4 py-3 text-right font-bold">IPTU/Mês</th>
            <th className="px-4 py-3 text-left font-bold">Utilização/Rateio</th>
            <th className="px-4 py-3 text-center font-bold">Renovação</th>
            <th className={`px-4 py-3 text-left font-bold ${readOnly ? 'rounded-tr-lg' : ''}`}>Observações</th>
            {!readOnly && <th className="px-4 py-3 rounded-tr-lg w-20"></th>}
          </tr>
        </thead>
        <tbody>
          {contratos.map((c, i) => (
            <tr
              key={c.id}
              className={`border-b border-slate-100 hover:bg-amber-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
            >
              {!readOnly && (
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${c.empresa === 'audi' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>
                    {c.empresa === 'audi' ? 'Audi' : 'VW'}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 font-semibold text-slate-800">{c.local}</td>
              <td className="px-4 py-3 text-slate-600">{c.proprietario || '—'}</td>
              <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{fmtBRL(c.valorMensal)}</td>
              <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{(Number(c.condominio) || 0) > 0 ? fmtBRL(Number(c.condominio)) : '—'}</td>
              <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.iptuAnual > 0 ? fmtBRL(c.iptuAnual) : '—'}</td>
              <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.iptuAnual > 0 ? fmtBRL(c.iptuAnual / 12) : '—'}</td>
              <td className="px-4 py-3 text-slate-600 text-xs">{c.utilizacaoRateio || '—'}</td>
              <td className="px-4 py-3 text-center"><RenovacaoBadge iso={c.dataRenovacao} /></td>
              <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate" title={c.observacoes}>{c.observacoes || '—'}</td>
              {!readOnly && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => onEdit?.(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete?.(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-amber-50 border-t-2 border-amber-200 font-bold">
            {!readOnly && <td className="px-4 py-2.5" />}
            <td className="px-4 py-2.5 text-xs font-bold text-amber-800 uppercase tracking-wide" colSpan={2}>
              Total ({contratos.length} {contratos.length === 1 ? 'contrato' : 'contratos'})
            </td>
            <td className="px-4 py-2.5 text-right font-black text-amber-900 tabular-nums">{fmtBRL(totalMensal)}</td>
            <td className="px-4 py-2.5 text-right font-bold text-amber-800 tabular-nums">{totalCondominio > 0 ? fmtBRL(totalCondominio) : '—'}</td>
            <td className="px-4 py-2.5 text-right font-bold text-amber-800 tabular-nums">{totalIptuAnual > 0 ? fmtBRL(totalIptuAnual) : '—'}</td>
            <td className="px-4 py-2.5 text-right font-bold text-amber-800 tabular-nums">{totalIptuMes > 0 ? fmtBRL(totalIptuMes) : '—'}</td>
            <td className="px-4 py-2.5" colSpan={readOnly ? 3 : 4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-start gap-4">
      <div className="p-2.5 rounded-xl" style={{ backgroundColor: accent + '1a', color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-black text-slate-800 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type TabId = 'audi' | 'vw' | 'total';

interface Props { onChangeBrand: () => void; }

export function CustosAlugueisDashboard({ onChangeBrand }: Props) {
  const [tab, setTab]                 = useState<TabId>('vw');
  const [contratos, setContratos]     = useState<ContratoAluguel[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState<{ open: boolean; mode: 'create' | 'edit'; initial: Partial<ContratoAluguel> & { empresa: Empresa } } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    kvGet<ContratoAluguel[]>(STORAGE_KEY).then(data => {
      setContratos(data ?? []);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (list: ContratoAluguel[]) => {
    setContratos(list);
    await kvSet(STORAGE_KEY, list);
  }, []);

  const handleSave = useCallback(async (data: Omit<ContratoAluguel, 'id'>) => {
    if (!modal) return;
    if (modal.mode === 'edit' && modal.initial.id) {
      await persist(contratos.map(c => c.id === modal.initial.id ? { ...data, id: modal.initial.id } : c));
    } else {
      await persist([...contratos, { ...data, id: crypto.randomUUID() }]);
    }
    setModal(null);
  }, [modal, contratos, persist]);

  const handleDelete = useCallback(async (id: string) => {
    await persist(contratos.filter(c => c.id !== id));
    setConfirmDelete(null);
  }, [contratos, persist]);

  const audis = contratos.filter(c => c.empresa === 'audi');
  const vws   = contratos.filter(c => c.empresa === 'vw');

  const currentContratos = tab === 'total' ? contratos : tab === 'audi' ? audis : vws;
  const empresaModal: Empresa = tab === 'audi' ? 'audi' : 'vw';

  const totalMensal  = currentContratos.reduce((s, c) => s + c.valorMensal, 0);
  const totalIptu    = currentContratos.reduce((s, c) => s + c.iptuAnual, 0);
  const custoTotal   = totalMensal + totalIptu / 12;
  const qtde         = currentContratos.length;
  const vencimentos  = currentContratos.filter(c => c.dataRenovacao && diasParaRenovacao(c.dataRenovacao) <= 90).length;

  const TAB_CONFIG: Record<TabId, { label: string; accent: string; count: number }> = {
    audi:  { label: 'Audi',  accent: '#bb0a30', count: audis.length },
    vw:    { label: 'VW',    accent: '#001e50', count: vws.length   },
    total: { label: 'Total', accent: '#7c3aed', count: contratos.length },
  };

  const handlePrint = useCallback(() => {
    const tabLabel = TAB_CONFIG[tab].label;
    const isTotal  = tab === 'total';
    const dataBR   = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaBR   = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const kpiRows = [
      { label: 'Custo Mensal (Aluguel)',  value: fmtBRL(totalMensal) },
      { label: 'IPTU Anual',              value: fmtBRL(totalIptu)   },
      { label: 'IPTU Mensal (div12)',     value: fmtBRL(totalIptu / 12) },
      { label: 'Custo Total c/ IPTU/Mes', value: fmtBRL(custoTotal)  },
      { label: 'Renovacoes em 90 dias',   value: String(vencimentos) },
    ];

    const empBadge = (emp: Empresa) => emp === 'audi'
      ? '<span style="background:#fce8ec;color:#bb0a30;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">Audi</span>'
      : '<span style="background:#e8f4fc;color:#001e50;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">VW</span>';

    const renText = (iso: string) => {
      if (!iso) return '-';
      const dias = diasParaRenovacao(iso);
      const txt  = formatDateBR(iso);
      if (dias < 0)   return `<span style="color:#dc2626;font-weight:700;">Vencido (${txt})</span>`;
      if (dias <= 30) return `<span style="color:#dc2626;font-weight:700;">${txt}</span>`;
      if (dias <= 90) return `<span style="color:#d97706;font-weight:700;">${txt}</span>`;
      return `<span style="color:#059669;">${txt}</span>`;
    };

    const tMensal      = currentContratos.reduce((s, c) => s + c.valorMensal, 0);
    const tCondominio  = currentContratos.reduce((s, c) => s + (Number(c.condominio) || 0), 0);
    const tIptu        = currentContratos.reduce((s, c) => s + c.iptuAnual, 0);

    const rows = currentContratos.map(c => [
      isTotal ? `<td>${empBadge(c.empresa)}</td>` : '',
      `<td style="font-weight:600;">${c.local}</td>`,
      `<td>${c.proprietario || '-'}</td>`,
      `<td style="text-align:right;font-weight:700;">${fmtBRL(c.valorMensal)}</td>`,
      `<td style="text-align:right;">${(Number(c.condominio) || 0) > 0 ? fmtBRL(Number(c.condominio)) : '-'}</td>`,
      `<td style="text-align:right;">${c.iptuAnual > 0 ? fmtBRL(c.iptuAnual) : '-'}</td>`,


      `<td style="text-align:right;">${c.iptuAnual > 0 ? fmtBRL(c.iptuAnual / 12) : '-'}</td>`,
      `<td>${c.utilizacaoRateio || '-'}</td>`,
      `<td>${renText(c.dataRenovacao)}</td>`,
      `<td style="color:#64748b;font-size:10px;">${c.observacoes || '-'}</td>`,
    ].join('')).map(r => `<tr>${r}</tr>`).join('');

    const empCol  = isTotal ? '<th>Empresa</th>' : '';
    const empFoot = isTotal ? '<td></td>' : '';

    const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>'
      + `<title>Custos com Alugueis - ${tabLabel}</title>`
      + '<style>'
      + '@page{size:A4 landscape;margin:12mm 10mm}'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff}'
      + '.hdr{border-bottom:3px solid #d97706;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}'
      + '.hdr h1{font-size:18px;font-weight:900}'
      + '.hdr p{font-size:11px;color:#64748b;margin-top:2px}'
      + '.meta{text-align:right;font-size:10px;color:#64748b}'
      + '.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}'
      + '.kpi{border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}'
      + '.kpi .lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}'
      + '.kpi .val{font-size:15px;font-weight:900}'
      + 'table{width:100%;border-collapse:collapse}'
      + 'thead tr{background:#1e293b;color:#fff}'
      + 'th{padding:7px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;white-space:nowrap}'
      + 'td{padding:6px 8px;font-size:10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}'
      + 'tr:nth-child(even) td{background:#f8fafc}'
      + 'tfoot td{background:#fef3c7;font-weight:700;font-size:10px;padding:7px 8px;border-top:2px solid #d97706}'
      + '.footer{margin-top:14px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px}'
      + '</style></head><body>'
      + `<div class="hdr"><div><h1>Custos com Alugueis - ${tabLabel}</h1><p>Grupo Sorana - Gestao de contratos de locacao</p></div>`
      + `<div class="meta"><div>Impresso em ${dataBR} as ${horaBR}</div><div>${currentContratos.length} contrato${currentContratos.length !== 1 ? 's' : ''}</div></div></div>`
      + `<div class="kpis">${kpiRows.map(k => `<div class="kpi"><div class="lbl">${k.label}</div><div class="val">${k.value}</div></div>`).join('')}</div>`
      + `<table><thead><tr>${empCol}<th>Local</th><th>Proprietario</th><th class="r">Valor Mensal</th><th class="r">Condominio</th><th class="r">IPTU Anual</th><th>IPTU/Mes</th><th>Utilizacao/Rateio</th><th>Renovacao</th><th>Observacoes</th></tr></thead>`
      + `<tbody>${rows}</tbody>`
      + `<tfoot><tr>${empFoot}<td colspan="2">Total (${currentContratos.length} contrato${currentContratos.length !== 1 ? 's' : ''})</td>`
      + `<td style="text-align:right;">${fmtBRL(tMensal)}</td>`
      + `<td style="text-align:right;">${tCondominio > 0 ? fmtBRL(tCondominio) : '-'}</td>`
      + `<td style="text-align:right;">${tIptu > 0 ? fmtBRL(tIptu) : '-'}</td>`
      + `<td style="text-align:right;">${tIptu > 0 ? fmtBRL(tIptu / 12) : '-'}</td>`
      + '<td colspan="3"></td></tr></tfoot></table>'
      + '<div class="footer">Grupo Sorana - Controle Financeiro - Documento gerado automaticamente</div>'
      + '<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}' + '<' + '/script>'
      + '</body></html>';

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }, [tab, currentContratos, totalMensal, totalIptu, custoTotal, vencimentos, TAB_CONFIG]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-100">
            <Building2 className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Custos com Aluguéis</h1>
            <p className="text-xs text-slate-500 mt-0.5">Gestão de contratos e custos de locação</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab !== 'total' && (
            <button
              onClick={() => setModal({ open: true, mode: 'create', initial: { empresa: empresaModal } })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={currentContratos.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={onChangeBrand}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50"
          >
            ← Voltar ao menu
          </button>
        </div>
      </header>

      {/* Abas */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-end gap-0 shrink-0">
        {(['vw', 'audi', 'total'] as TabId[]).map(t => {
          const cfg    = TAB_CONFIG[t];
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                active ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
              }`}
            >
              {t === 'total' ? <Layers className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              {cfg.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {cfg.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto p-6 space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Custo Mensal (Aluguel)" value={fmtBRL(totalMensal)} sub={`${qtde} ${qtde === 1 ? 'contrato' : 'contratos'}`} accent="#d97706" />
            <KpiCard icon={<Building2 className="w-5 h-5" />} label="IPTU Anual" value={fmtBRL(totalIptu)} sub={`≈ ${fmtBRL(totalIptu / 12)}/mês`} accent="#0f766e" />
            <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Custo Total c/ IPTU/Mês" value={fmtBRL(custoTotal)} sub="Aluguel + IPTU mensal" accent="#7c3aed" />
            <KpiCard icon={<Calendar className="w-5 h-5" />} label="Renovações em 90 dias" value={String(vencimentos)} sub={vencimentos > 0 ? 'contrato(s) a vencer' : 'Nenhum vencendo em breve'} accent={vencimentos > 0 ? '#dc2626' : '#059669'} />
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-amber-500" />
                {tab === 'total' ? 'Todos os Contratos' : `Contratos — ${TAB_CONFIG[tab].label}`}
              </h2>
              {tab === 'total' && (
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> Audi: {audis.length}</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-800" /> VW: {vws.length}</span>
                </div>
              )}
            </div>
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
              </div>
            ) : (
              <TabelaContratos
                contratos={currentContratos}
                readOnly={tab === 'total'}
                onEdit={c => setModal({ open: true, mode: 'edit', initial: c })}
                onDelete={id => setConfirmDelete(id)}
              />
            )}
          </div>

        </div>
      </div>

      {/* Modal */}
      {modal?.open && (
        <ContratoModal initial={modal.initial} onSave={handleSave} onCancel={() => setModal(null)} />
      )}

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-100">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Excluir contrato?</p>
                <p className="text-xs text-slate-500 mt-1">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
