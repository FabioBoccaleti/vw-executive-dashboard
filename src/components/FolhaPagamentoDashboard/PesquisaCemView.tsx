import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Check, Printer, PenLine, ShieldCheck, DollarSign, LockOpen, ClipboardList, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import { periodoKey } from './comissoesCalculoPeriodoStorage';
import type { CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';
import {
  loadColaboradores, saveColaboradores,
  loadRespostas, saveRespostas,
  loadTitulos, saveTitulos, tituloEfetivo,
  loadLancamentos, saveLancamentos,
  DEPTO_LABELS, DEPTOS,
  type PesquisaColaborador, type PesquisaDepto,
  type RespostasMap, type PesquisaTituloMap,
  type LancamentosMap, type PesquisaLancamento, type PesquisaLinhaSnapshot,
} from './pesquisaCemStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const CAMPO_LABELS: Record<CampoAssinaturaComissao, string> = {
  financeiro:         'Financeiro',
  gerenciaComercial:  'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria:          'Diretoria',
};
const CAMPOS_ASSINATURA = Object.keys(CAMPO_LABELS) as CampoAssinaturaComissao[];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

interface LinhaDemo {
  colaboradorId: string;
  nome: string;
  funcao: string;
  departamento: PesquisaDepto;
  valorPorPesquisa: number;
  qtd: number;
  total: number;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function PesquisaCemView({ onCompetencia }: { onCompetencia?: (year: number, month: number) => void }) {
  const { session } = useAuth();

  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [subView, setSubView] = useState<'premio' | 'demonstrativo'>('premio');

  const [colaboradores, setColaboradores] = useState<PesquisaColaborador[]>([]);
  const [respostas, setRespostas] = useState<RespostasMap>({});
  const [titulos, setTitulos] = useState<PesquisaTituloMap>({});
  const [lancamentos, setLancamentos] = useState<LancamentosMap>({});
  const [loading, setLoading] = useState(true);

  const [tituloDraft, setTituloDraft] = useState('');
  const [dialog, setDialog] = useState<{ edit?: PesquisaColaborador } | null>(null);

  const pk = periodoKey(filterYear, filterMonth);
  const competencia = `${MONTH_NAMES[filterMonth - 1]} de ${filterYear}`;
  const tituloAtual = tituloEfetivo(titulos, filterYear, filterMonth);
  const lancamento = lancamentos[pk];
  const pago = lancamento?.pago ?? false;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadColaboradores(), loadRespostas(), loadTitulos(), loadLancamentos(),
    ]).then(([c, re, ti, la]) => {
      setColaboradores(c);
      setRespostas(re);
      setTitulos(ti);
      setLancamentos(la);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTituloDraft(tituloEfetivo(titulos, filterYear, filterMonth));
  }, [pk, titulos, filterYear, filterMonth]);

  useEffect(() => { onCompetencia?.(filterYear, filterMonth); }, [filterYear, filterMonth, onCompetencia]);

  const respForPk = respostas[pk] ?? {};

  // Linhas do demonstrativo (colaboradores com nº de pesquisas > 0)
  const linhasLive: LinhaDemo[] = useMemo(() => {
    return colaboradores
      .map(c => {
        const qtd = respForPk[c.id] ?? 0;
        return { colaboradorId: c.id, nome: c.nome, funcao: c.funcao, departamento: c.departamento, valorPorPesquisa: c.valorPorPesquisa, qtd, total: c.valorPorPesquisa * qtd };
      })
      .filter(l => l.qtd > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [colaboradores, respForPk]);

  const linhas: LinhaDemo[] = pago && lancamento?.snapshotLinhas?.length
    ? lancamento.snapshotLinhas.map(s => ({ ...s }))
    : linhasLive;

  const deptosPresentes = DEPTOS.filter(dep => linhas.some(l => l.departamento === dep));
  const showTotal = deptosPresentes.length >= 2;

  // ── Persistência ────────────────────────────────────────────────────────────
  function persistColaboradores(next: PesquisaColaborador[]) {
    setColaboradores(next);
    saveColaboradores(next);
  }
  function persistRespostas(next: RespostasMap) {
    setRespostas(next);
    saveRespostas(next);
  }
  async function persistLancamentos(next: LancamentosMap) {
    setLancamentos(next);
    await saveLancamentos(next);
  }

  // ── Título ──────────────────────────────────────────────────────────────────
  async function handleSaveTitulo() {
    const next = { ...titulos, [pk]: tituloDraft.trim() };
    setTitulos(next);
    await saveTitulos(next);
    toast.success('Título salvo (vale deste mês em diante).');
  }

  // ── Colaborador (cadastro) ──────────────────────────────────────────────────
  function handleSaveColaborador(data: Omit<PesquisaColaborador, 'id' | 'ativo' | 'ordem'>, editId?: string) {
    if (editId) {
      persistColaboradores(colaboradores.map(c => c.id === editId ? { ...c, ...data } : c));
      toast.success('Colaborador atualizado.');
    } else {
      persistColaboradores([...colaboradores, { id: crypto.randomUUID(), ativo: true, ...data }]);
      toast.success('Colaborador cadastrado.');
    }
    setDialog(null);
  }
  function handleDeleteColaborador(id: string) {
    persistColaboradores(colaboradores.filter(c => c.id !== id));
    toast.success('Colaborador excluído.');
  }

  // ── Nº de pesquisas ─────────────────────────────────────────────────────────
  function setQtd(colabId: string, qtd: number) {
    if (pago) return;
    persistRespostas({ ...respostas, [pk]: { ...respForPk, [colabId]: qtd } });
  }

  // ── Pago / reabrir / assinar ────────────────────────────────────────────────
  const [reabrirDialog, setReabrirDialog] = useState<{ senha: string; erro: string | null } | null>(null);
  const [assinaDialog, setAssinaDialog] = useState<{ campo: CampoAssinaturaComissao; senha: string; loading: boolean; erro: string | null } | null>(null);
  const [savingPago, setSavingPago] = useState(false);

  async function marcarPago() {
    setSavingPago(true);
    try {
      const snapshot: PesquisaLinhaSnapshot[] = linhasLive.map(l => ({ ...l }));
      const upd: PesquisaLancamento = {
        ...lancamento,
        pago: true,
        dataPagamento: new Date().toISOString().split('T')[0],
        titulo: tituloAtual,
        snapshotLinhas: snapshot,
        assinaturas: lancamento?.assinaturas,
      };
      await persistLancamentos({ ...lancamentos, [pk]: upd });
      toast.success('Demonstrativo marcado como pago.');
    } finally {
      setSavingPago(false);
    }
  }
  async function confirmarReabrir() {
    if (!reabrirDialog) return;
    if (reabrirDialog.senha !== '1985') { setReabrirDialog(p => p ? { ...p, erro: 'Senha incorreta.' } : p); return; }
    await persistLancamentos({ ...lancamentos, [pk]: { pago: false, assinaturas: {} } });
    setReabrirDialog(null);
    toast.success('Demonstrativo reaberto.');
  }
  async function confirmarAssinatura() {
    if (!assinaDialog || !session) return;
    setAssinaDialog(p => p ? { ...p, loading: true, erro: null } : p);
    const result = await apiLogin(session.username, assinaDialog.senha);
    if ('error' in result) {
      setAssinaDialog(p => p ? { ...p, loading: false, erro: 'Senha incorreta. Tente novamente.' } : p);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name: (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    const existing = lancamento ?? { pago: false };
    const upd: PesquisaLancamento = { ...existing, assinaturas: { ...(existing.assinaturas ?? {}), [assinaDialog.campo]: assinatura } };
    await persistLancamentos({ ...lancamentos, [pk]: upd });
    toast.success(`Assinatura de ${CAMPO_LABELS[assinaDialog.campo]} registrada!`);
    setAssinaDialog(null);
  }

  // ── Impressão ───────────────────────────────────────────────────────────────
  function handlePrint() {
    const titulo = pago && lancamento?.titulo ? lancamento.titulo : tituloAtual;
    const tdB = 'padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:9px;';
    const thS = (align = 'left') => `background:#334155;color:white;padding:5px 8px;font-size:8px;font-weight:600;text-align:${align};`;
    const tfB = 'background:#1e293b;color:white;padding:6px 8px;font-size:9px;font-weight:700;';
    const totaisDep: Record<string, number> = {};
    deptosPresentes.forEach(d => { totaisDep[d] = 0; });
    let totalGeral = 0;
    let totalQtd = 0;
    const rowsHtml = linhas.map(l => {
      totalGeral += l.total; totaisDep[l.departamento] += l.total; totalQtd += l.qtd;
      const depCells = deptosPresentes.map(d => `<td style="${tdB}text-align:right;">${l.departamento === d ? 'R$ ' + fmtBRL(l.total) : '<span style=\"color:#cbd5e1\">—</span>'}</td>`).join('');
      const totalCell = showTotal ? `<td style="${tdB}text-align:right;font-weight:700;color:#6d28d9;">R$ ${fmtBRL(l.total)}</td>` : '';
      return `<tr>
        <td style="${tdB}">${escapeHtml(l.nome)}</td>
        <td style="${tdB}color:#64748b;">${escapeHtml(l.funcao || '—')}</td>
        <td style="${tdB}text-align:center;color:#64748b;">${l.qtd}</td>
        ${depCells}${totalCell}
      </tr>`;
    }).join('');
    const depTh = deptosPresentes.map(d => `<th style="${thS('right')}">Prêmio ${DEPTO_LABELS[d]}</th>`).join('');
    const totalTh = showTotal ? `<th style="${thS('right')}">Prêmio Total</th>` : '';
    const depTf = deptosPresentes.map(d => `<td style="${tfB}text-align:right;">R$ ${fmtBRL(totaisDep[d])}</td>`).join('');
    const totalTf = showTotal ? `<td style="${tfB}text-align:right;">R$ ${fmtBRL(totalGeral)}</td>` : '';

    const camposHtml = CAMPOS_ASSINATURA.map(key => {
      const ass = lancamento?.assinaturas?.[key];
      if (ass) {
        const dt = new Date(ass.dataHora).toLocaleString('pt-BR');
        return `<div><p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${CAMPO_LABELS[key]}</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 8px;">
            <p style="font-size:7.5px;color:#15803d;font-weight:600;margin:0;">${escapeHtml(ass.name || ass.username)}</p>
            <p style="font-size:7px;color:#16a34a;margin:2px 0 0;">${dt}</p>
            <p style="font-size:6.5px;font-weight:700;color:#15803d;margin:3px 0 0;">&#10003; ASSINATURA ELETRÔNICA</p>
          </div></div>`;
      }
      return `<div><p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${CAMPO_LABELS[key]}</p>
        <div style="border:1.5px dashed #cbd5e1;border-radius:6px;padding:8px;text-align:center;"><p style="font-size:7px;color:#94a3b8;margin:0;">—</p></div></div>`;
    }).join('');

    const html = `<div style="font-family:Inter,system-ui,sans-serif;">
      <div style="background:#1e293b;color:white;border-radius:10px;overflow:hidden;margin-bottom:10px;">
        <div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div><p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Demonstrativo de Prêmio</p>
            <p style="font-size:15px;font-weight:700;margin:0;">${escapeHtml(titulo || '(sem título)')}</p></div>
          <div style="text-align:right;"><p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Competência</p>
            <p style="font-size:15px;font-weight:700;margin:0;">${competencia}</p></div>
        </div>
        <div style="background:#0f172a;padding:6px 18px;"><span style="background:${pago ? '#d1fae5' : '#fef3c7'};color:${pago ? '#065f46' : '#92400e'};padding:2px 8px;border-radius:20px;font-size:7.5px;font-weight:700;">${pago ? 'Pago' : 'Pendente'}</span>
          <span style="margin-left:8px;font-size:8px;color:#cbd5e1;">Total: R$ ${fmtBRL(totalGeral)}</span></div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th style="${thS()}">Colaborador</th><th style="${thS()}">Função</th><th style="${thS('center')}">Pesquisas</th>${depTh}${totalTh}</tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td style="${tfB}" colspan="2">Total</td><td style="${tfB}text-align:center;">${totalQtd}</td>${depTf}${totalTf}</tr></tfoot>
      </table>
      <div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 8px;">ASSINATURAS</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${camposHtml}</div>
      </div>
    </div>`;

    const root = document.getElementById('print-root');
    if (!root) { window.print(); return; }
    root.innerHTML = html;
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 portrait; margin: 1cm; } #print-root { font-family: Inter, system-ui, sans-serif; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }`;
    document.head.appendChild(style);
    window.onafterprint = () => { document.head.removeChild(style); root.innerHTML = ''; window.onafterprint = null; };
    window.print();
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {/* Barra: competência + título */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ano</span>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex items-center gap-0.5 flex-wrap">
            {MONTHS.map((m, i) => (
              <button key={m} onClick={() => setFilterMonth(i + 1)} className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${filterMonth === i + 1 ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Título da bonificação</span>
          <input value={tituloDraft} onChange={e => setTituloDraft(e.target.value)} disabled={pago} placeholder="ex: Prêmio Pesquisa CEM" className="border border-slate-200 rounded px-2.5 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-slate-50" />
          <button onClick={handleSaveTitulo} disabled={pago || tituloDraft.trim() === tituloAtual} className="flex items-center gap-1 text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded px-3 py-1.5 font-semibold">
            <Check className="w-3.5 h-3.5" /> Salvar
          </button>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
        {([
          { id: 'premio' as const, label: 'Prêmio', icon: ClipboardList },
          { id: 'demonstrativo' as const, label: 'Demonstrativo', icon: FileText },
        ]).map(t => (
          <button key={t.id} onClick={() => setSubView(t.id)} className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${subView === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        {subView === 'premio' ? (
          <PremioTab
            colaboradores={colaboradores}
            respForPk={respForPk}
            pago={pago}
            competencia={competencia}
            onSetQtd={setQtd}
            onNew={() => setDialog({})}
            onEdit={c => setDialog({ edit: c })}
            onDelete={handleDeleteColaborador}
          />
        ) : (
          <DemonstrativoTab
            titulo={pago && lancamento?.titulo ? lancamento.titulo : tituloAtual}
            competencia={competencia}
            linhas={linhas}
            deptosPresentes={deptosPresentes}
            showTotal={showTotal}
            pago={pago}
            lancamento={lancamento}
            savingPago={savingPago}
            onMarcarPago={marcarPago}
            onReabrir={() => setReabrirDialog({ senha: '', erro: null })}
            onAssinar={campo => setAssinaDialog({ campo, senha: '', loading: false, erro: null })}
            onPrint={handlePrint}
          />
        )}
      </div>

      {dialog && (
        <ColaboradorDialog
          initial={dialog.edit}
          onCancel={() => setDialog(null)}
          onConfirm={(data) => handleSaveColaborador(data, dialog.edit?.id)}
        />
      )}

      {reabrirDialog && (
        <SenhaDialog
          titulo="Reabrir demonstrativo"
          descricao="Isso remove o pagamento e todas as assinaturas. Digite a senha para confirmar."
          erro={reabrirDialog.erro}
          senha={reabrirDialog.senha}
          onChange={s => setReabrirDialog(p => p ? { ...p, senha: s, erro: null } : p)}
          onCancel={() => setReabrirDialog(null)}
          onConfirm={confirmarReabrir}
          confirmLabel="Reabrir"
        />
      )}

      {assinaDialog && (
        <SenhaDialog
          titulo={`Assinar — ${CAMPO_LABELS[assinaDialog.campo]}`}
          descricao="Confirme sua senha para registrar a assinatura eletrônica."
          usuario={session?.username ?? ''}
          erro={assinaDialog.erro}
          senha={assinaDialog.senha}
          loading={assinaDialog.loading}
          onChange={s => setAssinaDialog(p => p ? { ...p, senha: s, erro: null } : p)}
          onCancel={() => setAssinaDialog(null)}
          onConfirm={confirmarAssinatura}
          confirmLabel={assinaDialog.loading ? 'Assinando...' : 'Assinar'}
        />
      )}
    </div>
  );
}

// ─── Aba Prêmio (cadastro + nº de pesquisas) ──────────────────────────────────
function PremioTab({
  colaboradores, respForPk, pago, competencia, onSetQtd, onNew, onEdit, onDelete,
}: {
  colaboradores: PesquisaColaborador[];
  respForPk: Record<string, number>;
  pago: boolean;
  competencia: string;
  onSetQtd: (colabId: string, qtd: number) => void;
  onNew: () => void;
  onEdit: (c: PesquisaColaborador) => void;
  onDelete: (id: string) => void;
}) {
  const [pwd, setPwd] = useState<{ kind: 'edit' | 'delete'; colab: PesquisaColaborador; senha: string; erro: string | null } | null>(null);
  const ativos = colaboradores.filter(c => c.ativo);

  function handlePwdConfirm() {
    if (!pwd) return;
    if (pwd.senha !== '1985') { setPwd({ ...pwd, erro: 'Senha incorreta.' }); return; }
    if (pwd.kind === 'edit') onEdit(pwd.colab); else onDelete(pwd.colab.id);
    setPwd(null);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-4">
      {pago && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700">
          O demonstrativo de <strong>{competencia}</strong> está <strong>pago</strong> — a edição está bloqueada. Reabra o demonstrativo para editar.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Colaboradores</h3>
          <p className="text-xs text-slate-400">Informe o nº de pesquisas respondidas em {competencia}.</p>
        </div>
        <button onClick={onNew} disabled={pago} className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 font-semibold">
          <Plus className="w-3.5 h-3.5" /> Cadastrar colaborador
        </button>
      </div>

      {ativos.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-12">Nenhum colaborador cadastrado.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {ativos.map(c => {
            const qtd = respForPk[c.id] ?? 0;
            const total = c.valorPorPesquisa * qtd;
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-800">{c.nome}</p>
                  <p className="text-xs text-slate-500">{c.funcao || '—'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{DEPTO_LABELS[c.departamento]}</span>
                    <span className="text-[10px] text-slate-400">R$ {fmtBRL(c.valorPorPesquisa)} / pesquisa</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Pesquisas:</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      disabled={pago}
                      value={qtd || ''}
                      onChange={e => onSetQtd(c.id, Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm text-right disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase">Prêmio</p>
                    <p className="text-sm font-bold text-teal-700">R$ {fmtBRL(total)}</p>
                  </div>
                  <button onClick={() => setPwd({ kind: 'edit', colab: c, senha: '', erro: null })} disabled={pago} className="text-slate-300 hover:text-slate-600 p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPwd({ kind: 'delete', colab: c, senha: '', erro: null })} disabled={pago} className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pwd && (
        <SenhaDialog
          titulo={pwd.kind === 'edit' ? 'Editar colaborador' : 'Excluir colaborador'}
          descricao={pwd.kind === 'edit' ? `Digite a senha para editar ${pwd.colab.nome}.` : `Digite a senha para excluir ${pwd.colab.nome}.`}
          senha={pwd.senha}
          erro={pwd.erro}
          onChange={s => setPwd(p => p ? { ...p, senha: s, erro: null } : p)}
          onCancel={() => setPwd(null)}
          onConfirm={handlePwdConfirm}
          confirmLabel={pwd.kind === 'edit' ? 'Continuar' : 'Excluir'}
        />
      )}    </div>
  );
}

// ─── Aba Demonstrativo ────────────────────────────────────────────────────────
function DemonstrativoTab({
  titulo, competencia, linhas, deptosPresentes, showTotal, pago, lancamento, savingPago,
  onMarcarPago, onReabrir, onAssinar, onPrint,
}: {
  titulo: string;
  competencia: string;
  linhas: LinhaDemo[];
  deptosPresentes: PesquisaDepto[];
  showTotal: boolean;
  pago: boolean;
  lancamento: PesquisaLancamento | undefined;
  savingPago: boolean;
  onMarcarPago: () => void;
  onReabrir: () => void;
  onAssinar: (campo: CampoAssinaturaComissao) => void;
  onPrint: () => void;
}) {
  const totaisDep: Record<string, number> = {};
  deptosPresentes.forEach(d => { totaisDep[d] = 0; });
  let totalGeral = 0;
  let totalQtd = 0;
  linhas.forEach(l => { totalGeral += l.total; totaisDep[l.departamento] += l.total; totalQtd += l.qtd; });

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button onClick={onPrint} disabled={linhas.length === 0} className="flex items-center gap-1.5 text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 font-semibold text-slate-600">
          <Printer className="w-3.5 h-3.5" /> Imprimir PDF
        </button>
        {pago ? (
          <button onClick={onReabrir} className="flex items-center gap-1.5 text-xs border border-amber-300 text-amber-700 rounded px-3 py-1.5 hover:bg-amber-50 font-semibold">
            <LockOpen className="w-3.5 h-3.5" /> Reabrir demonstrativo
          </button>
        ) : (
          <button onClick={onMarcarPago} disabled={savingPago || linhas.length === 0} className="flex items-center gap-1.5 text-xs bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-amber-900 rounded px-3 py-1.5 font-semibold">
            <DollarSign className="w-3.5 h-3.5" /> Marcar como pago
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Demonstrativo de Prêmio</p>
            <p className="text-lg font-bold mt-0.5">{titulo || '(sem título)'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Competência</p>
            <p className="text-lg font-bold mt-0.5">{competencia}</p>
          </div>
        </div>
        <div className="bg-slate-900 px-6 py-2 flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pago ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{pago ? 'Pago' : 'Pendente'}</span>
          <span className="text-[11px] text-slate-300">Total: <strong className="text-white">R$ {fmtBRL(totalGeral)}</strong></span>
        </div>

        <div className="p-4">
          {linhas.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Nenhum colaborador com pesquisas informadas em {competencia}.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left px-3 py-2 font-semibold">Colaborador</th>
                    <th className="text-left px-3 py-2 font-semibold">Função</th>
                    <th className="text-center px-3 py-2 font-semibold">Pesquisas</th>
                    {deptosPresentes.map(d => <th key={d} className="text-right px-3 py-2 font-semibold">Prêmio {DEPTO_LABELS[d]}</th>)}
                    {showTotal && <th className="text-right px-3 py-2 font-semibold text-violet-700">Prêmio Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.colaboradorId} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">{l.nome}</td>
                      <td className="px-3 py-2 text-slate-500">{l.funcao || '—'}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{l.qtd}</td>
                      {deptosPresentes.map(d => (
                        <td key={d} className="px-3 py-2 text-right tabular-nums">
                          {l.departamento === d ? `R$ ${fmtBRL(l.total)}` : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      {showTotal && <td className="px-3 py-2 text-right tabular-nums font-bold text-violet-700">R$ {fmtBRL(l.total)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold text-xs">
                    <td className="px-3 py-2.5 text-left" colSpan={2}>Total</td>
                    <td className="px-3 py-2.5 text-center">{totalQtd}</td>
                    {deptosPresentes.map(d => <td key={d} className="px-3 py-2.5 text-right tabular-nums">R$ {fmtBRL(totaisDep[d])}</td>)}
                    {showTotal && <td className="px-3 py-2.5 text-right tabular-nums">R$ {fmtBRL(totalGeral)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Assinaturas */}
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assinaturas</p>
          <div className="grid grid-cols-2 gap-3">
            {CAMPOS_ASSINATURA.map(campo => {
              const ass = lancamento?.assinaturas?.[campo];
              if (ass) {
                return (
                  <div key={campo} className="border border-emerald-200 rounded-lg px-3 py-2.5 bg-emerald-50">
                    <p className="text-[11px] font-bold text-emerald-700 mb-0.5">{CAMPO_LABELS[campo]}</p>
                    <p className="text-xs font-bold text-emerald-800">{ass.name || ass.username}</p>
                    <p className="text-[10px] text-emerald-500">{new Date(ass.dataHora).toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> ASSINATURA ELETRÔNICA</p>
                  </div>
                );
              }
              return (
                <div key={campo} className="border border-dashed border-slate-300 rounded-lg px-3 py-2.5 bg-slate-50">
                  <p className="text-[11px] font-bold text-slate-400">{CAMPO_LABELS[campo]}</p>
                  <button onClick={() => onAssinar(campo)} className="mt-2 flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold no-print">
                    <PenLine className="w-3.5 h-3.5" /> Assinar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog de cadastro do colaborador ────────────────────────────────────────
function ColaboradorDialog({
  initial, onCancel, onConfirm,
}: {
  initial?: PesquisaColaborador;
  onCancel: () => void;
  onConfirm: (data: Omit<PesquisaColaborador, 'id' | 'ativo' | 'ordem'>) => void;
}) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [funcao, setFuncao] = useState(initial?.funcao ?? '');
  const [valor, setValor] = useState<number | undefined>(initial?.valorPorPesquisa);
  const [departamento, setDepartamento] = useState<PesquisaDepto>(initial?.departamento ?? 'novos');

  function submit() {
    if (!nome.trim()) { toast.error('Informe o nome.'); return; }
    onConfirm({ nome: nome.trim(), funcao: funcao.trim(), valorPorPesquisa: valor ?? 0, departamento });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 py-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <p className="font-semibold text-slate-800 text-sm">{initial ? 'Editar colaborador' : 'Cadastrar colaborador'}</p>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome <span className="text-red-500">*</span></label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" placeholder="Nome do colaborador" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Função</label>
            <input value={funcao} onChange={e => setFuncao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" placeholder="ex: Consultor de Vendas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor por pesquisa</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">R$</span>
                <input type="number" min="0" step="0.01" value={valor ?? ''} onChange={e => setValor(e.target.value === '' ? undefined : parseFloat(e.target.value))} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400" placeholder="0,00" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamento</label>
              <select value={departamento} onChange={e => setDepartamento(e.target.value as PesquisaDepto)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {DEPTOS.map(d => <option key={d} value={d}>{DEPTO_LABELS[d]}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onCancel} className="text-xs border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 font-medium">Cancelar</button>
          <button onClick={submit} className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-5 py-2 font-semibold">{initial ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog genérico de senha ─────────────────────────────────────────────────
function SenhaDialog({
  titulo, descricao, usuario, senha, erro, loading, onChange, onCancel, onConfirm, confirmLabel,
}: {
  titulo: string;
  descricao: string;
  usuario?: string;
  senha: string;
  erro: string | null;
  loading?: boolean;
  onChange: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-3">
        <p className="font-semibold text-slate-800 text-sm">{titulo}</p>
        <p className="text-xs text-slate-500">{descricao}</p>
        {usuario !== undefined && <input value={usuario} readOnly className="border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm text-slate-500" />}
        <input type="password" value={senha} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onConfirm(); }} className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" placeholder="Senha" autoFocus />
        {erro && <p className="text-xs text-red-500">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-xs border border-slate-200 rounded px-3 py-2 hover:bg-slate-50">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded px-4 py-2 font-semibold">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
