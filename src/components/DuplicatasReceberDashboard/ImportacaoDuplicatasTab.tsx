import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DuplicatasMarca } from './DuplicatasReceberDashboard';
import {
  decodeFileBuffer,
  parseDuplicatasTxt,
  saveDuplicatas,
  getDuplicatas,
  deleteDuplicatas,
  type DuplicatasImport,
} from './duplicatasStorage';
import { RemoverDadosButton } from '@/components/EstoquePecasDashboard/RemoverDadosButton';

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

// ─── Formatação de colunas de valor (moeda) ────────────────────────────────────
const VALUE_COLUMNS = new Set([
  'VENCIDO', 'AVENCER',
  'AVENCER30', 'AVENCER60', 'AVENCER90', 'AVENCER120', 'AVENCERM120',
  'VENCIDA30', 'VENCIDA60', 'VENCIDA90', 'VENCIDA120', 'VENCIDAM120',
]);

const brCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function isNumericColumn(header: string): boolean {
  return VALUE_COLUMNS.has(header.toUpperCase());
}

/** Converte o valor bruto (ex.: '0001225,89' ou '1.225,89') em número; null se não for numérico. */
function parseRawNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Texto a exibir numa célula, aplicando formatação de moeda nas colunas de valor. */
function formatCell(header: string, raw: string): string {
  if (isNumericColumn(header)) {
    const n = parseRawNumber(raw);
    if (n !== null) return brCurrency.format(n);
  }
  return raw;
}

interface Props {
  marca: DuplicatasMarca;
}

/**
 * Lê os bytes do arquivo com fallback.
 * Tenta a API moderna (Blob.arrayBuffer) e, se falhar (ex.: lock transitório),
 * recorre ao FileReader, que às vezes contorna o problema.
 */
async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'));
      reader.readAsArrayBuffer(file);
    });
  }
}

/** True quando o erro indica que o SO não liberou os bytes do arquivo (arquivo em uso/placeholder). */
function isFileReadError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotReadableError' || err.name === 'SecurityError');
}

export function ImportacaoDuplicatasTab({ marca }: Props) {
  const [month, setMonth] = useState<string>(currentMonth());
  const [data, setData] = useState<DuplicatasImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const saved = await getDuplicatas(marca.id, month);
      setData(saved);
    } finally {
      setLoading(false);
    }
  }, [marca.id, month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await readFileBuffer(file);
      const content = decodeFileBuffer(buffer);
      const { headers, rows } = parseDuplicatasTxt(content);

      if (headers.length === 0 || rows.length === 0) {
        toast.error('O arquivo não contém dados válidos.');
        return;
      }

      const imported: DuplicatasImport = {
        marca: marca.id,
        month,
        fileName: file.name,
        importedAt: Date.now(),
        headers,
        rows,
      };

      const ok = await saveDuplicatas(imported);
      if (!ok) {
        toast.error('Não foi possível salvar os dados importados.');
        return;
      }

      setData(imported);
      toast.success(`${rows.length} duplicatas importadas para ${formatMonthLabel(month)}.`);
    } catch (err) {
      console.error('Erro ao importar duplicatas:', err);
      if (isFileReadError(err)) {
        toast.error(
          'Não foi possível ler o arquivo. Ele pode estar aberto em outro programa (Excel, Bloco de Notas, ERP) ou ser um arquivo do OneDrive/rede ainda não baixado. Feche o arquivo, copie-o para uma pasta local (ex.: Área de Trabalho) e tente novamente.',
          { duration: 10000 },
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Erro ao ler o arquivo: ${msg}`);
      }
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    await deleteDuplicatas(marca.id, month);
    setData(null);
    toast.success(`Duplicatas de ${formatMonthLabel(month)} removidas.`);
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
            style={{ ['--tw-ring-color' as string]: marca.primary }}
          />
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: marca.primary }}
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importing ? 'Importando...' : 'Importar Posição de Duplicatas (TXT)'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {data && (
          <>
            <RemoverDadosButton
              alvo={`as duplicatas de ${formatMonthLabel(month)} (${marca.name})`}
              onConfirm={handleRemove}
            />
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-slate-700">{data.rows.length} duplicatas</p>
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
              Posição de Duplicatas a Receber — {marca.name} · {formatMonthLabel(data.month)}
            </h3>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {data.headers.map((h, i) => (
                    <th
                      key={i}
                      className={`font-semibold text-white px-3 py-2 whitespace-nowrap ${
                        isNumericColumn(h) ? 'text-right' : 'text-left'
                      }`}
                      style={{ backgroundColor: marca.primary }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {data.headers.map((h, ci) => (
                      <td
                        key={ci}
                        className={`px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100 ${
                          isNumericColumn(h) ? 'text-right tabular-nums' : 'text-left'
                        }`}
                      >
                        {formatCell(h, row[ci])}
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
              style={{ backgroundColor: marca.primaryLight, color: marca.primary }}
            >
              <FileText className="w-8 h-8" />
            </div>
            <p className="text-slate-600 font-medium">
              Nenhuma posição de duplicatas importada para {formatMonthLabel(month)} ({marca.name}).
            </p>
            <p className="text-sm text-slate-400">
              Selecione o mês e importe o arquivo TXT para gerar a tabela.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
