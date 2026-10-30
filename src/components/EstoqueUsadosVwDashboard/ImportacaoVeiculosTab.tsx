import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RemoverDadosButton } from '@/components/EstoquePecasDashboard/RemoverDadosButton';
import { parseVeiculosWorkbook } from './veiculosExcel';
import {
  saveInventarioVeiculos,
  getInventarioVeiculos,
  deleteInventarioVeiculos,
  type VeiculoImport,
} from './veiculosStorage';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return month;
  return `${MONTH_NAMES[idx]} de ${y}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface Props {
  primary: string;
  primaryLight: string;
}

export function ImportacaoVeiculosTab({ primary, primaryLight }: Props) {
  const [month, setMonth] = useState<string>(currentMonth());
  const [data, setData] = useState<VeiculoImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const saved = await getInventarioVeiculos(month);
      setData(saved);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const { headers, rows, veiculos } = parseVeiculosWorkbook(buffer);

      if (headers.length === 0 || veiculos.length === 0) {
        toast.error('O arquivo não contém dados válidos.');
        return;
      }

      const imported: VeiculoImport = {
        month,
        fileName: file.name,
        importedAt: Date.now(),
        headers,
        rows,
        veiculos,
      };

      const ok = await saveInventarioVeiculos(imported);
      if (!ok) {
        toast.error('Não foi possível salvar os dados importados.');
        return;
      }

      setData(imported);
      toast.success(`${veiculos.length} veículos importados para ${formatMonthLabel(month)}.`);
    } catch (err) {
      console.error('Erro ao importar inventário de veículos:', err);
      toast.error('Erro ao ler o arquivo.');
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    await deleteInventarioVeiculos(month);
    setData(null);
    toast.success(`Inventário de ${formatMonthLabel(month)} removido.`);
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Barra de controles */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Mês de referência</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: primary }}
          />
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: primary }}
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importing ? 'Importando...' : 'Importar arquivo Excel'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {data && (
          <>
            <RemoverDadosButton
              alvo={`o inventário de ${formatMonthLabel(month)}`}
              onConfirm={handleRemove}
            />
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-slate-700">{data.veiculos.length} veículos</p>
              <p className="text-xs text-slate-400">
                {data.fileName} · importado em {new Date(data.importedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      ) : data ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">
              Inventário de Veículos — {formatMonthLabel(data.month)}
            </h3>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {data.headers.map((h, i) => (
                    <th
                      key={i}
                      className="font-semibold text-white px-3 py-2 whitespace-nowrap text-left"
                      style={{ backgroundColor: primary }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {data.headers.map((_, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100 text-left"
                      >
                        {row[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16">
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: primaryLight, color: primary }}
            >
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <p className="text-slate-600 font-medium">
              Nenhum inventário importado para {formatMonthLabel(month)}.
            </p>
            <p className="text-sm text-slate-400">
              Selecione o mês e importe o arquivo Excel (.xlsx) para gerar a tabela.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
