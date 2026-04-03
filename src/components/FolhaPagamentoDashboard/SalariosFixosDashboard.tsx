import { Fragment, useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, TableProperties, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  loadSalariosFixos,
  saveAllParsedSalarios,
  clearSalariosFixos,
  parseSalariosTxt,
  type SalarioFuncionario,
  type SalarioBrand,
} from './salariosFixosStorage';
import { SalariosAnalise } from './SalariosAnalise';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

type ActiveTab = 'audi' | 'vw' | 'total';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCurrency(val: string | number): string {
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumSalarios(rows: SalarioFuncionario[]): number {
  return rows.reduce((acc, e) => acc + (parseFloat(e.salario) || 0), 0);
}

function groupByRevenda(rows: SalarioFuncionario[]) {
  const map = new Map<string, SalarioFuncionario[]>();
  for (const e of rows) {
    const key = e.revenda || 'Sem Revenda';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([revenda, items]) => ({ revenda, items }));
}

function groupByDept(rows: SalarioFuncionario[]) {
  const map = new Map<string, SalarioFuncionario[]>();
  for (const e of rows) {
    const key = e.departamento || 'Sem Departamento';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([dept, items]) => ({ dept, items }));
}

// ── Table for a single brand tab ──────────────────────────────────────────────
function SingleBrandTable({ rows }: { rows: SalarioFuncionario[] }) {
  const revendaGroups = groupByRevenda(rows);
  const grandTotal    = sumSalarios(rows);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-28">Código</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Nome do Empregado</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-32">Data de Admissão</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Cargo</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Departamento</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-36">Salário</th>
          </tr>
        </thead>
        <tbody>
          {revendaGroups.map(({ revenda, items }) => {
            const deptGroups   = groupByDept(items);
            const revendaTotal = sumSalarios(items);
            return (
              <Fragment key={revenda}>
                {/* Revenda band */}
                <tr className="bg-teal-50 border-b border-teal-100">
                  <td colSpan={6} className="px-4 py-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                    {revenda}
                  </td>
                </tr>

                {deptGroups.map(({ dept, items: empRows }) => (
                  <Fragment key={dept}>
                    {/* Dept header */}
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <td colSpan={6} className="px-6 py-1.5 text-xs font-semibold text-slate-500 italic">
                        {dept}
                      </td>
                    </tr>

                    {/* Employee rows */}
                    {empRows.map(emp => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 text-slate-500 font-mono text-xs">{emp.codigo}</td>
                        <td className="px-4 py-2 text-slate-800 font-medium">{emp.nome}</td>
                        <td className="px-4 py-2 text-slate-500">{emp.dataAdmissao}</td>
                        <td className="px-4 py-2 text-slate-600">{emp.cargo}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{emp.departamento}</td>
                        <td className="px-4 py-2 text-right text-slate-800 font-mono">{fmtCurrency(emp.salario)}</td>
                      </tr>
                    ))}

                    {/* Dept subtotal */}
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <td colSpan={5} className="px-6 py-1.5 text-right text-xs font-semibold text-slate-400">
                        Subtotal — {dept}
                      </td>
                      <td className="px-4 py-1.5 text-right font-semibold text-slate-600 font-mono text-xs">
                        {fmtCurrency(sumSalarios(empRows))}
                      </td>
                    </tr>
                  </Fragment>
                ))}

                {/* Revenda subtotal */}
                <tr className="bg-teal-50 border-b border-teal-200">
                  <td colSpan={5} className="px-4 py-2 text-right text-xs font-bold text-teal-700">
                    Total — {revenda}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-teal-700 font-mono">
                    {fmtCurrency(revendaTotal)}
                  </td>
                </tr>
              </Fragment>
            );
          })}

          {/* Grand total */}
          <tr className="bg-teal-700">
            <td colSpan={5} className="px-4 py-3 text-right font-bold text-white text-sm">
              Total Geral
            </td>
            <td className="px-4 py-3 text-right font-bold text-white font-mono">
              {fmtCurrency(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Table for Total tab ───────────────────────────────────────────────────────
function TotalTable({
  audiRows,
  vwRows,
}: {
  audiRows: SalarioFuncionario[];
  vwRows: SalarioFuncionario[];
}) {
  const audiTotal  = sumSalarios(audiRows);
  const vwTotal    = sumSalarios(vwRows);
  const grandTotal = audiTotal + vwTotal;

  function renderBrandSection(
    rows: SalarioFuncionario[],
    label: string,
    total: number,
    colorClass: string,
  ) {
    if (rows.length === 0) return null;
    const revendaGroups = groupByRevenda(rows);

    return (
      <Fragment key={label}>
        {/* Brand header */}
        <tr className={`${colorClass} border-b`}>
          <td colSpan={7} className="px-4 py-2 text-xs font-bold uppercase tracking-wider">
            {label}
          </td>
        </tr>

        {revendaGroups.map(({ revenda, items }) => (
          <Fragment key={revenda}>
            <tr className="bg-slate-50 border-b border-slate-100">
              <td colSpan={7} className="px-6 py-1.5 text-xs font-semibold text-slate-500 italic">
                {revenda}
              </td>
            </tr>
            {items.map(emp => (
              <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{emp.codigo}</td>
                <td className="px-4 py-2 text-slate-800 font-medium">{emp.nome}</td>
                <td className="px-4 py-2 text-slate-500">{emp.dataAdmissao}</td>
                <td className="px-4 py-2 text-slate-600">{emp.cargo}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{emp.departamento}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{emp.revenda}</td>
                <td className="px-4 py-2 text-right text-slate-800 font-mono">{fmtCurrency(emp.salario)}</td>
              </tr>
            ))}
          </Fragment>
        ))}

        {/* Brand subtotal */}
        <tr className={`${colorClass} border-b`}>
          <td colSpan={6} className="px-4 py-2 text-right text-xs font-bold">
            Total {label}
          </td>
          <td className="px-4 py-2 text-right font-bold font-mono">
            {fmtCurrency(total)}
          </td>
        </tr>
      </Fragment>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-28">Código</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Nome do Empregado</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-32">Data de Admissão</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Cargo</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Departamento</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-32">Revenda</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider w-36">Salário</th>
          </tr>
        </thead>
        <tbody>
          {renderBrandSection(audiRows, 'Audi', audiTotal, 'bg-orange-50 text-orange-700 border-orange-100')}
          {renderBrandSection(vwRows,   'VW',   vwTotal,   'bg-blue-50 text-blue-700 border-blue-100')}

          {/* Grand total */}
          <tr className="bg-slate-800">
            <td colSpan={6} className="px-4 py-3 text-right font-bold text-white text-sm">
              Total Geral
            </td>
            <td className="px-4 py-3 text-right font-bold text-white font-mono">
              {fmtCurrency(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
interface SalariosFixosDashboardProps {
  onBack: () => void;
}

export function SalariosFixosDashboard({ onBack }: SalariosFixosDashboardProps) {
  const [mainView, setMainView]         = useState<'relacao' | 'analise'>('relacao');
  const [activeTab, setActiveTab]       = useState<ActiveTab>('audi');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(CURRENT_YEAR);

  const [audiRows, setAudiRows] = useState<SalarioFuncionario[]>([]);
  const [vwRows,   setVwRows]   = useState<SalarioFuncionario[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load when tab / period changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [audi, vw] = await Promise.all([
        activeTab === 'audi'  || activeTab === 'total' ? loadSalariosFixos('audi', selectedYear, selectedMonth) : Promise.resolve(audiRows),
        activeTab === 'vw'    || activeTab === 'total' ? loadSalariosFixos('vw',   selectedYear, selectedMonth) : Promise.resolve(vwRows),
      ]);
      if (!cancelled) {
        if (activeTab === 'audi' || activeTab === 'total') setAudiRows(audi);
        if (activeTab === 'vw'   || activeTab === 'total') setVwRows(vw);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedMonth, selectedYear]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const text     = await file.text();
    const sections = parseSalariosTxt(text);

    if (sections.length === 0) {
      toast.error('Arquivo não reconhecido ou sem funcionários. Verifique o formato do TXT.');
      return;
    }

    await saveAllParsedSalarios(sections);

    // Deduce period from the first section
    const firstYear  = sections[0].year;
    const firstMonth = sections[0].month;

    // Build toast summary
    const audiCount = sections.filter(s => s.brand === 'audi').reduce((n, s) => n + s.employees.length, 0);
    const vwCount   = sections.filter(s => s.brand === 'vw').reduce((n, s) => n + s.employees.length, 0);
    const parts = [
      audiCount > 0 ? `Audi: ${audiCount}` : null,
      vwCount   > 0 ? `VW: ${vwCount}`   : null,
    ].filter(Boolean);
    toast.success(`Importado (${MONTHS[firstMonth - 1]}/${firstYear}): ${parts.join(' · ')} funcionário(s)`);

    // Navigate to imported period and reload both brands
    setSelectedYear(firstYear);
    setSelectedMonth(firstMonth);
    const [newAudi, newVw] = await Promise.all([
      loadSalariosFixos('audi', firstYear, firstMonth),
      loadSalariosFixos('vw',   firstYear, firstMonth),
    ]);
    setAudiRows(newAudi);
    setVwRows(newVw);
  }

  async function handleClearConfirmed() {
    setConfirmClear(false);
    const brands: SalarioBrand[] = activeTab === 'total' ? ['audi', 'vw'] : [activeTab as SalarioBrand];
    await Promise.all(brands.map(b => clearSalariosFixos(b, selectedYear, selectedMonth)));
    if (activeTab === 'audi' || activeTab === 'total') setAudiRows([]);
    if (activeTab === 'vw'   || activeTab === 'total') setVwRows([]);
    const label = activeTab === 'total' ? 'Audi e VW' : activeTab === 'audi' ? 'Audi' : 'VW';
    toast.success(`Dados de ${label} — ${MONTHS[selectedMonth - 1]}/${selectedYear} removidos.`);
  }

  const currentRows = activeTab === 'audi' ? audiRows : activeTab === 'vw' ? vwRows : [...audiRows, ...vwRows];
  const hasData     = currentRows.length > 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handleImport}
      />

      {/* Confirm clear dialog */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Limpar dados</p>
                <p className="text-slate-500 text-xs mt-1">
                  Isso removerá todos os registros de{' '}
                  <strong>{activeTab === 'total' ? 'Audi e VW' : activeTab === 'audi' ? 'Audi' : 'VW'}</strong>{' '}
                  em <strong>{MONTHS[selectedMonth - 1]}/{selectedYear}</strong>. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50"
                onClick={() => setConfirmClear(false)}
              >
                Cancelar
              </button>
              <button
                className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5"
                onClick={handleClearConfirmed}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Salários Fixo</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seletor de visão principal */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setMainView('relacao')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'relacao' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              Relação de Salários Fixos
            </button>
            <button
              onClick={() => setMainView('analise')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'analise' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Análise
            </button>
          </div>
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Tabs Audi/VW/Total — apenas na visão Relação */}
      {mainView === 'relacao' && (
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-0">
        {(['audi', 'vw', 'total'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab === 'audi' ? 'Audi' : tab === 'vw' ? 'VW' : 'Total'}
          </button>
        ))}
      </div>
      )}

      {/* Toolbar + Content */}
      {mainView === 'relacao' ? (<>
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mês</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ano</label>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            Importar TXT
          </Button>
          {hasData && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="w-4 h-4" />
              Limpar Tudo
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Carregando...
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">
              Nenhum dado para {MONTHS[selectedMonth - 1]}/{selectedYear}
            </p>
            {activeTab !== 'total' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-teal-600 hover:underline"
              >
                Importar TXT
              </button>
            )}
          </div>
        ) : activeTab === 'total' ? (
          <TotalTable audiRows={audiRows} vwRows={vwRows} />
        ) : (
          <SingleBrandTable rows={currentRows} />
        )}
      </div>
      </>) : (
        /* Aba Análise */
        <>
          <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-0">
            {(['audi', 'vw', 'total'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-teal-500 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab === 'audi' ? 'Audi' : tab === 'vw' ? 'VW' : 'Total'}
              </button>
            ))}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <SalariosAnalise
              rows={
                activeTab === 'audi'  ? audiRows :
                activeTab === 'vw'    ? vwRows   :
                [...audiRows, ...vwRows]
              }
              brand={activeTab}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              brandLabel={activeTab === 'audi' ? 'Audi' : activeTab === 'vw' ? 'VW' : 'Total'}
            />
          </div>
        </>
      )}
    </div>
  );
}
