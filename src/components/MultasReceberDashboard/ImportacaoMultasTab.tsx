import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { decodeFileBuffer } from '@/components/DuplicatasReceberDashboard/duplicatasStorage';
import { getMultas, parseMultasTxt, saveMultas, type MultasImport } from './multasStorage';

export function ImportacaoMultasTab() {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [data, setData] = useState<MultasImport | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError('');
    getMultas(month).then(saved => {
      if (active) setData(saved);
    }).catch(err => {
      console.error('Erro ao carregar multas:', err);
      if (active) setError('Não foi possível carregar as multas deste mês.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, retry]);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) resolve(reader.result);
          else reject(new Error('Não foi possível ler os bytes do arquivo.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo. Verifique se está disponível localmente.'));
        reader.onabort = () => reject(new Error('Leitura do arquivo cancelada.'));
        reader.readAsArrayBuffer(file);
      });
      const parsed = parseMultasTxt(decodeFileBuffer(buffer));
      const imported: MultasImport = { ...parsed, month, fileName: file.name, importedAt: Date.now() };
      await saveMultas(imported);
      setData(imported);
      setError('');
      toast.success(`${parsed.rows.length} títulos importados com sucesso.`);
    } catch (err) {
      console.error('Erro ao importar multas:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao importar multas.');
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="multas-import-month" className="text-xs font-medium text-slate-500">Mês de referência</label>
          <input id="multas-import-month" type="month" value={month} disabled={importing}
            onChange={e => { if (e.target.value) setMonth(e.target.value); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700" />
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={importing || loading || !!error}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 disabled:opacity-60">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importing ? 'Importando...' : 'Importar Multas a Receber (TXT)'}
        </button>
        <input ref={inputRef} aria-label="Arquivo TXT de multas" type="file" accept=".txt,text/plain" className="hidden"
          onChange={e => { const file = e.target.files?.[0]; if (file) void handleFile(file); }} />
        {data && (
          <div className="ml-auto text-right">
            <p className="text-sm font-medium text-slate-700">{data.rows.length} títulos</p>
            <p className="text-xs text-slate-400">{data.fileName} · importado em {new Date(data.importedAt).toLocaleString('pt-BR')}</p>
          </div>
        )}
      </div>
      {error ? (
        <div role="alert" className="bg-red-50 text-red-700 rounded-xl p-4">
          <p>{error}</p>
          <button onClick={() => setRetry(value => value + 1)} className="mt-2 text-sm underline">Tentar novamente</button>
        </div>
      )
        : loading ? <p className="py-16 text-center text-slate-400">Carregando...</p>
        : data ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-bold text-slate-700 border-b border-slate-100">Posição de Multas a Receber · {data.month}</h3>
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-indigo-600 text-white">
                  <tr>{data.headers.map(header => <th key={header} className="text-left px-3 py-2 whitespace-nowrap">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                      {data.headers.map((header, j) => <td key={header} className="px-3 py-1.5 whitespace-nowrap text-slate-700 border-b border-slate-100">{row[j]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center">
            <FileText className="w-10 h-10 mx-auto mb-4 text-indigo-600" />
            <p className="text-slate-600 font-medium">Nenhuma posição de multas importada para este mês.</p>
            <p className="text-sm text-slate-400 mt-1">Selecione o mês e importe o arquivo TXT para gerar a análise consolidada.</p>
          </div>
        )}
    </div>
  );
}
