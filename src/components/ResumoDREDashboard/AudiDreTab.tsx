import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadDreAudi,
  saveDreAudi,
  createEmptyDreAudiRow,
  type DreAudiRow,
  type DreAudiDept,
} from './dreAudiStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function fmtNum(v: string): string {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return v;
  return n.toLocaleString('pt-BR');
}

function sumDepts(depts: DreAudiDept[], field: keyof DreAudiDept): string {
  const total = depts.reduce((acc, d) => {
    const v = parseFloat(String(d[field]).replace(/\./g, '').replace(',', '.'));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  if (total === 0) return '';
  return total.toLocaleString('pt-BR');
}

// ─── Linhas da tabela ──────────────────────────────────────────────────────────

interface DreLineConfig {
  label: string;
  field: keyof DreAudiDept;
  isBold?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  isNegative?: boolean;
  separator?: boolean;
}

const DRE_LINES: DreLineConfig[] = [
  { label: 'Quant. / Passagens',                  field: 'quant',                      isBold: false },
  { label: '',                                      field: 'quant',                      separator: true },
  { label: 'Receita Bruta de Vendas',              field: 'receitaBruta',               isBold: true },
  { label: '(-) Impostos Incidentes e Devoluções', field: 'impostosDevol',              indent: true, isNegative: true },
  { label: 'Vendas Líquidas',                      field: 'vendasLiquidas',             isSubtotal: true },
  { label: '(-) Custos',                            field: 'custos',                     indent: true, isNegative: true },
  { label: 'Lucro Bruto Apurado',                  field: 'lucroBruto',                 isSubtotal: true },
  { label: 'Rendas Operacionais Líquidas',          field: 'rendasOperacionais',         indent: true },
  { label: 'Resultado Operacional Bruto',          field: 'resultadoOperacionalBruto',  isSubtotal: true },
  { label: '(-) Despesas com Vendas',              field: 'despesasVendas',             indent: true, isNegative: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO',               field: 'margemContribuicao',         isTotal: true },
  { label: '',                                      field: 'margemContribuicao',         separator: true },
  { label: '(-) Despesas com Pessoal',             field: 'despPessoal',                indent: true, isNegative: true },
  { label: '(-) Despesas com Serviços de Terceiros', field: 'despServTerceiros',        indent: true, isNegative: true },
  { label: '(-) Despesas com Ocupação',            field: 'despOcupacao',               indent: true, isNegative: true },
  { label: '(-) Despesas com Funcionamento',       field: 'despFuncionamento',          indent: true, isNegative: true },
  { label: 'TOTAL DAS DESPESAS FIXAS',             field: 'totalDespesasFixas',         isTotal: true },
  { label: '',                                      field: 'totalDespesasFixas',         separator: true },
  { label: 'Resultado Antes do Financeiro',        field: 'resultadoAntesFinanceiro',   isSubtotal: true },
  { label: '(+) Receitas Financeiras',             field: 'receitasFinanceiras',        indent: true },
  { label: '(-) Despesas Financeiras',             field: 'despesasFinanceiras',        indent: true, isNegative: true },
  { label: 'Resultado Antes dos Impostos',         field: 'resultadoAntesImpostos',     isSubtotal: true },
  { label: '(-) I.R. e C.S.',                      field: 'irCs',                       indent: true, isNegative: true },
  { label: 'RESULTADO LÍQUIDO NO PERÍODO',         field: 'resultadoLiquido',           isTotal: true },
];

// ─── Departamentos ─────────────────────────────────────────────────────────────

type DeptKey = 'novos' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const DEPTS: { key: DeptKey; label: string; color: string }[] = [
  { key: 'novos',    label: 'Veículos Novos',      color: '#1d4ed8' },
  { key: 'usados',   label: 'Veículos Usados',     color: '#7c3aed' },
  { key: 'pecas',    label: 'Peças e Acessórios',  color: '#059669' },
  { key: 'oficina',  label: 'Oficina / Assist. Técnica', color: '#d97706' },
  { key: 'funilaria',label: 'Funilaria',            color: '#db2777' },
  { key: 'adm',      label: 'Administração',        color: '#64748b' },
];

// ─── Componente ──────────────────────────────────────────────────────────────

interface AudiDreTabProps {
  year: number;
  month: number;
  diasUteis: number;
}

export function AudiDreTab({ year, month }: AudiDreTabProps) {
  const [data, setData]       = useState<DreAudiRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [activeSection, setActiveSection] = useState<'resumo' | DeptKey>('resumo');

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setDirty(false);
    loadDreAudi(year, month).then(row => {
      setData(row ?? createEmptyDreAudiRow(year, month));
      setLoading(false);
    });
  }, [year, month]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    const ok = await saveDreAudi(data);
    setSaving(false);
    if (ok) {
      setDirty(false);
      toast.success('Dados salvos com sucesso!');
    } else {
      toast.error('Erro ao salvar. Tente novamente.');
    }
  }, [data]);

  // ── Edição de célula ────────────────────────────────────────────────────────
  const handleCellChange = useCallback(
    (dept: DeptKey, field: keyof DreAudiDept, value: string) => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, [dept]: { ...prev[dept], [field]: value } };
      });
      setDirty(true);
    },
    []
  );

  const handleAjusteChange = useCallback(
    (field: 'icmsSt' | 'honorariosAdvogados', value: string) => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, ajustes: { ...prev.ajustes, [field]: value } };
      });
      setDirty(true);
    },
    []
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const deptList = DEPTS.map(d => data[d.key]);

  return (
    <div className="flex flex-col gap-0 flex-1">

      {/* ── Sub-navegação de seções ─────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSection('resumo')}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeSection === 'resumo'
              ? 'border-[#bb0a30] text-[#bb0a30]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Resumo Geral
        </button>
        {DEPTS.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveSection(d.key)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeSection === d.key
                ? 'border-[#bb0a30] text-[#bb0a30]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {d.label}
          </button>
        ))}
        <button
          onClick={() => setActiveSection('ajustes' as any)}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            (activeSection as string) === 'ajustes'
              ? 'border-[#bb0a30] text-[#bb0a30]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Ajustes Esporádicos
        </button>

        <div className="flex-1" />

        {/* Botão Salvar */}
        <button
          disabled={!dirty || saving}
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors my-1.5 ${
            dirty
              ? 'bg-[#bb0a30] text-white hover:bg-[#990826]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">

        {/* RESUMO GERAL — todas as colunas */}
        {activeSection === 'resumo' && (
          <ResumoTable
            data={data}
            deptList={deptList}
            onCellChange={handleCellChange}
            year={year}
            month={month}
          />
        )}

        {/* DETALHE POR DEPARTAMENTO */}
        {DEPTS.map(d =>
          activeSection === d.key ? (
            <DeptTable
              key={d.key}
              deptKey={d.key}
              deptLabel={d.label}
              deptColor={d.color}
              dept={data[d.key]}
              year={year}
              month={month}
              onChange={(field, value) => handleCellChange(d.key, field, value)}
            />
          ) : null
        )}

        {/* AJUSTES */}
        {(activeSection as string) === 'ajustes' && (
          <AjustesTable ajustes={data.ajustes} onChange={handleAjusteChange} data={data} />
        )}
      </div>
    </div>
  );
}

// ─── Tabela Resumo Geral ───────────────────────────────────────────────────────

function ResumoTable({
  data,
  deptList,
  onCellChange,
  year,
  month,
}: {
  data: DreAudiRow;
  deptList: DreAudiDept[];
  onCellChange: (dept: DeptKey, field: keyof DreAudiDept, value: string) => void;
  year: number;
  month: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-[#bb0a30] text-white px-6 py-3">
        <h2 className="font-bold text-base">AUDI LAPA/PINHEIROS</h2>
        <p className="text-xs text-red-200 mt-0.5">{MONTHS[month - 1]} de {year} — Demonstrativo de Resultados</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-52 min-w-[13rem]">Descrição</th>
              {DEPTS.map(d => (
                <th key={d.key} className="text-center px-3 py-2.5 font-semibold min-w-[8rem] text-[#bb0a30]">
                  {d.label}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 font-bold text-slate-700 min-w-[8rem] bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={8} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal
                ? 'bg-slate-800 text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-slate-700'
                : 'hover:bg-slate-50 text-slate-600';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''} ${line.isTotal ? 'text-white' : ''}`}>
                    {line.label}
                  </td>
                  {DEPTS.map((d, di) => (
                    <td key={d.key} className="px-2 py-1 text-right">
                      <EditableCell
                        value={data[d.key][line.field]}
                        onChange={v => onCellChange(d.key, line.field, v)}
                        isTotal={line.isTotal}
                        isNegative={line.isNegative}
                        isQuant={isQuant}
                      />
                    </td>
                  ))}
                  {/* Total */}
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-700'}`}>
                    {isQuant
                      ? (() => {
                          const t = deptList.reduce((s, dep) => s + (parseInt(dep.quant) || 0), 0);
                          return t > 0 ? t.toString() : '—';
                        })()
                      : (() => {
                          const s = sumDepts(deptList, line.field);
                          return s ? fmtNum(s) : '—';
                        })()
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tabela por Departamento ───────────────────────────────────────────────────

function DeptTable({
  deptKey,
  deptLabel,
  deptColor,
  dept,
  year,
  month,
  onChange,
}: {
  deptKey: DeptKey;
  deptLabel: string;
  deptColor: string;
  dept: DreAudiDept;
  year: number;
  month: number;
  onChange: (field: keyof DreAudiDept, value: string) => void;
}) {
  // Para o detalhe por departamento mostramos Jan, Fev, Mar e Total no Ano
  // Por enquanto só o mês atual fica editável — os meses anteriores virão
  // dos dados salvos (lidos no futuro pelo componente pai)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 text-white font-bold flex items-center gap-3 bg-[#bb0a30]">
        <span className="text-base">Audi Lapa/Pinheiros — {deptLabel}</span>
        <span className="text-xs opacity-75 font-normal">{MONTHS[month - 1]}/{year}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-52 min-w-[13rem]">Descrição</th>
              <th className="text-center px-3 py-2.5 font-semibold text-slate-600 min-w-[8rem]">
                {MONTHS[month - 1]}/{year}
              </th>
              <th className="text-center px-3 py-2.5 font-semibold text-slate-400 min-w-[6rem]">% H</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={3} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal
                ? 'bg-slate-800 text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-slate-700'
                : 'hover:bg-slate-50 text-slate-600';

              // % H sobre Vendas Líquidas
              const vendasLiq = parseFloat(dept.vendasLiquidas.replace(/\./g, '').replace(',', '.')) || 0;
              const val = parseFloat(String(dept[line.field]).replace(/\./g, '').replace(',', '.'));
              const pctH = vendasLiq !== 0 && !isNaN(val) && !isQuant
                ? ((val / vendasLiq) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                : '';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  <td className="px-2 py-1 text-right">
                    <EditableCell
                      value={dept[line.field]}
                      onChange={v => onChange(line.field, v)}
                      isTotal={line.isTotal}
                      isNegative={line.isNegative}
                      isQuant={isQuant}
                    />
                  </td>
                  <td className={`px-3 py-1.5 text-right text-slate-400 ${line.isTotal ? 'text-slate-300' : ''}`}>
                    {pctH}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tabela de Ajustes ────────────────────────────────────────────────────────

function AjustesTable({
  ajustes,
  onChange,
  data,
}: {
  ajustes: DreAudiRow['ajustes'];
  onChange: (field: 'icmsSt' | 'honorariosAdvogados', value: string) => void;
  data: DreAudiRow;
}) {
  const deptList = DEPTS.map(d => data[d.key]);
  const totalLiquido = sumDepts(deptList, 'resultadoLiquido');

  const icmsSt = parseFloat(ajustes.icmsSt.replace(/\./g, '').replace(',', '.')) || 0;
  const honorarios = parseFloat(ajustes.honorariosAdvogados.replace(/\./g, '').replace(',', '.')) || 0;
  const totalLiqNum = parseFloat(totalLiquido.replace(/\./g, '').replace(',', '.')) || 0;
  const resultadoAjustado = totalLiqNum - icmsSt + honorarios;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-700 text-white px-6 py-3">
        <h2 className="font-bold text-base">AJUSTES NO RESULTADO DO MÊS</h2>
        <p className="text-xs text-slate-300 mt-0.5">Despesas e Receitas Esporádicas</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-80">Descrição</th>
              <th className="text-center px-3 py-2.5 font-semibold text-slate-600 min-w-[9rem]">Adm.</th>
              <th className="text-center px-3 py-2.5 font-bold text-slate-700 min-w-[9rem] bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-slate-800 text-white font-bold">
              <td className="px-4 py-1.5">Resultado Líquido no Período</td>
              <td className="px-3 py-1.5 text-right">{totalLiquido ? fmtNum(totalLiquido) : '—'}</td>
              <td className="px-3 py-1.5 text-right bg-slate-700">{totalLiquido ? fmtNum(totalLiquido) : '—'}</td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50 text-slate-600">
              <td className="px-4 py-1.5 pl-7">(-) ICMS ST recebido do fabricante</td>
              <td className="px-2 py-1 text-right">
                <EditableCell
                  value={ajustes.icmsSt}
                  onChange={v => onChange('icmsSt', v)}
                  isNegative
                />
              </td>
              <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-700 font-semibold">
                {ajustes.icmsSt ? fmtNum(ajustes.icmsSt) : '—'}
              </td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50 text-slate-600">
              <td className="px-4 py-1.5 pl-7">(+) Honorários advogados s/ ICMS ST recebido</td>
              <td className="px-2 py-1 text-right">
                <EditableCell
                  value={ajustes.honorariosAdvogados}
                  onChange={v => onChange('honorariosAdvogados', v)}
                />
              </td>
              <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-700 font-semibold">
                {ajustes.honorariosAdvogados ? fmtNum(ajustes.honorariosAdvogados) : '—'}
              </td>
            </tr>
            <tr className="bg-slate-800 text-white font-bold">
              <td className="px-4 py-2">RESULTADO DO PERÍODO AJUSTADO</td>
              <td className="px-3 py-2 text-right">
                {resultadoAjustado !== 0
                  ? resultadoAjustado.toLocaleString('pt-BR')
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right bg-slate-700">
                {resultadoAjustado !== 0
                  ? resultadoAjustado.toLocaleString('pt-BR')
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Célula Editável ──────────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  isTotal = false,
  isNegative = false,
  isQuant = false,
}: {
  value: string;
  onChange: (v: string) => void;
  isTotal?: boolean;
  isNegative?: boolean;
  isQuant?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  const numVal = parseFloat(value.replace(/\./g, '').replace(',', '.'));
  const isNeg  = !isNaN(numVal) && numVal < 0;
  const display = value ? fmtNum(value) : '';

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commitEdit() {
    onChange(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
        className={`w-full text-right bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 outline-none text-xs ${isTotal ? 'text-slate-800' : ''}`}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Clique para editar"
      className={`block w-full text-right cursor-pointer rounded px-1 py-0.5 hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-200 transition-colors min-w-[5rem] ${
        isNeg ? 'text-red-600' : ''
      } ${isTotal ? (isNeg ? 'text-red-300' : 'text-white') : ''} ${!value ? 'text-slate-300' : ''}`}
    >
      {display || (isQuant ? '—' : '—')}
    </span>
  );
}
