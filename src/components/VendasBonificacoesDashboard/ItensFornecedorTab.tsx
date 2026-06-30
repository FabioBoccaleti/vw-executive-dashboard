import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, Search, X, Package, Building2, ChevronDown } from 'lucide-react';
import {
  loadAndAggregateResumo,
  loadEntradaPecasItens,
  type EntradaPecasItemLite,
  type EntradaPecasResumo,
} from './entradaPecasStorage';

interface Props {
  filterYear: number;
  filterMonth: number | null;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function ItensFornecedorTab({ filterYear, filterMonth }: Props) {
  const [resumo, setResumo] = useState<EntradaPecasResumo | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [selectedForn, setSelectedForn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [itens, setItens] = useState<EntradaPecasItemLite[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Carrega resumo (lista de fornecedores) quando o período muda
  useEffect(() => {
    setLoadingResumo(true);
    setSelectedForn(null);
    setItens([]);
    setSearchQuery('');
    loadAndAggregateResumo(filterMonth, filterYear).then(data => {
      setResumo(data);
      setLoadingResumo(false);
    });
  }, [filterYear, filterMonth]);

  // Carrega itens quando o fornecedor é selecionado
  useEffect(() => {
    if (!selectedForn) {
      setItens([]);
      return;
    }
    setLoadingItens(true);
    const months =
      filterMonth !== null ? [filterMonth] : Array.from({ length: 12 }, (_, i) => i + 1);
    Promise.all(months.map(m => loadEntradaPecasItens(m, filterYear))).then(results => {
      const all = results
        .flat()
        .filter(item => item.forn === selectedForn)
        .sort((a, b) => b.custo - a.custo);
      setItens(all);
      setLoadingItens(false);
    });
  }, [selectedForn, filterYear, filterMonth]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suppliers = useMemo(
    () => resumo?.byFornecedor.map(f => f.nomeCliente) ?? [],
    [resumo],
  );

  const filteredSuppliers = useMemo(
    () => suppliers.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())),
    [suppliers, searchQuery],
  );

  const periodLabel =
    filterMonth !== null ? `${MONTH_NAMES[filterMonth - 1]}/${filterYear}` : `${filterYear}`;

  const totalNFs = useMemo(() => new Set(itens.map(i => i.nf)).size, [itens]);
  const totalCusto = useMemo(() => itens.reduce((s, i) => s + i.custo, 0), [itens]);

  if (loadingResumo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Seletor de fornecedor */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
            Fornecedor&nbsp;&mdash;&nbsp;{periodLabel}
          </p>

          {suppliers.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 p-3 bg-slate-100 rounded-xl border border-slate-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Nenhum dado para {periodLabel}. Importe um arquivo TXT na aba &quot;Importação&quot; primeiro.
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              {/* Input de busca */}
              <div
                className={`flex items-center gap-2.5 bg-white border-2 rounded-xl px-3.5 py-2.5 transition-all cursor-pointer ${
                  dropdownOpen
                    ? 'border-emerald-400 shadow-lg shadow-emerald-100/60'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => {
                  if (!dropdownOpen) {
                    setSearchQuery('');
                    setDropdownOpen(true);
                  }
                }}
              >
                {selectedForn && !dropdownOpen ? (
                  <Building2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
                <input
                  type="text"
                  value={dropdownOpen ? searchQuery : (selectedForn ?? '')}
                  placeholder={`Buscar entre ${suppliers.length} fornecedores...`}
                  onFocus={() => {
                    setSearchQuery('');
                    setDropdownOpen(true);
                  }}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 text-sm bg-transparent outline-none placeholder-slate-400 text-slate-700 font-medium min-w-0"
                />
                {selectedForn && !dropdownOpen && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedForn(null);
                      setSearchQuery('');
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-400 text-center">
                      Nenhum fornecedor encontrado
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">
                        {filteredSuppliers.length} fornecedor{filteredSuppliers.length !== 1 ? 'es' : ''}
                      </div>
                      {filteredSuppliers.map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setSelectedForn(s);
                            setDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-50 last:border-0 ${
                            selectedForn === s
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Estado: nenhum fornecedor selecionado */}
      {!selectedForn && suppliers.length > 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Package className="w-8 h-8 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Selecione um fornecedor</p>
              <p className="text-xs text-slate-400 mt-1">
                Escolha um fornecedor acima para ver os itens comprados em{' '}
                <span className="font-medium text-slate-500">{periodLabel}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading itens */}
      {selectedForn && loadingItens && (
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500" />
          <span className="text-sm text-slate-500">Carregando itens de {selectedForn}…</span>
        </div>
      )}

      {/* Tabela de itens */}
      {selectedForn && !loadingItens && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Barra de resumo */}
          <div className="bg-white border-b border-slate-100 px-6 py-2.5 flex items-center gap-5 flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">NFs únicas</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                {totalNFs}
              </span>
            </div>
            <span className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Itens</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                {itens.length}
              </span>
            </div>
            <span className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Total Custo Médio</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                {fmtBRL(totalCusto)}
              </span>
            </div>
            <span className="ml-auto text-xs text-slate-400 truncate max-w-xs" title={selectedForn}>
              {selectedForn}
            </span>
          </div>

          {itens.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">
                  Nenhum item encontrado para este fornecedor em {periodLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <div className="absolute inset-0 overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-b border-slate-200 w-10">
                        #
                      </th>
                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">
                        NF
                      </th>
                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">
                        Cód. Peça
                      </th>
                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">
                        Descrição
                      </th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">
                        Qtde
                      </th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">
                        Vl. Unit. (R$)
                      </th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">
                        Custo Médio (R$)&nbsp;↓
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, i) => (
                      <tr
                        key={`${item.nf}-${item.cod}-${i}`}
                        className={`border-b border-slate-100 hover:bg-emerald-50/40 transition-colors ${
                          i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{item.nf}</td>
                        <td className="px-3 py-2 text-slate-700 font-mono text-[11px] font-semibold">
                          {item.cod}
                        </td>
                        <td
                          className="px-3 py-2 text-slate-700 max-w-xs truncate"
                          title={item.desc}
                        >
                          {item.desc}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                          {fmtNum(item.qtde)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                          {fmtBRL(item.unit)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">
                          {fmtBRL(item.custo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Rodapé fixo */}
                <div className="sticky bottom-0 bg-white border-t-2 border-slate-200 px-6 py-3 flex items-center gap-6 text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">NFs:</span>
                    <span className="font-bold text-slate-700">{totalNFs}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Itens:</span>
                    <span className="font-bold text-slate-700">{itens.length}</span>
                  </div>
                  <span className="w-px h-4 bg-slate-200" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Total Custo Médio:</span>
                    <span className="font-bold text-emerald-700">{fmtBRL(totalCusto)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
