import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { loadFluxoCaixaIndex, loadFluxoCaixaRaw } from './fluxoCaixaStorage';
import { businessMetricsData } from '@/data/businessMetricsData';
import { businessMetricsData2024 } from '@/data/businessMetricsData2024';
import { businessMetricsData2026 } from '@/data/businessMetricsData2026';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  data: any;
  selectedMonth: number;
  selectedYear: number;
  prevMonthAccounts: Record<string, any> | null;
  janAccounts: Record<string, any> | null;
}

// ─── Utilitários de formatação para contexto ────────────────────────────────
function fmtNum(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(2);
}

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function parseBalanceteForContext(text: string): Record<string, any> {
  const lines = text.split('\n').filter(l => l.trim());
  const accounts: Record<string, any> = {};
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel === 'T') continue;
    const parse = (v: string) => parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
    accounts[conta?.trim()] = {
      nivel: nivel?.trim(), conta: conta?.trim(), desc: desc?.trim(),
      saldoAnt: parse(saldoAnt), valDeb: parse(valDeb), valCred: parse(valCred), saldoAtual: parse(saldoAtual),
    };
  }
  return accounts;
}

// ─── Construtor de contexto ─────────────────────────────────────────────────
function buildAccountsSummary(accounts: Record<string, any>, label: string): string {
  const lines: string[] = [`\n## ${label}`, 'Conta | Descrição | Saldo Anterior | Débitos | Créditos | Saldo Atual'];
  const sorted = Object.values(accounts).sort((a: any, b: any) => (a.conta || '').localeCompare(b.conta || ''));
  for (const acc of sorted) {
    const a = acc as any;
    // Include up to first 4 levels (e.g. 1.1.2.01) for a comprehensive but manageable context
    const depth = (a.conta || '').split('.').length;
    if (depth <= 4) {
      lines.push(`${a.conta} | ${a.desc} | ${fmtNum(a.saldoAnt)} | ${fmtNum(a.valDeb)} | ${fmtNum(a.valCred)} | ${fmtNum(a.saldoAtual)}`);
    }
  }
  return lines.join('\n');
}

function buildVWMetricsSummary(): string {
  const lines: string[] = ['\n## Métricas de Negócio — VW (Dashboard Operacional)'];

  const datasets: { label: string; data: any }[] = [
    { label: 'VW 2024', data: businessMetricsData2024 },
    { label: 'VW 2025', data: businessMetricsData },
    { label: 'VW 2026', data: businessMetricsData2026 },
  ];

  for (const ds of datasets) {
    const d = ds.data;
    if (!d?.months) continue;
    lines.push(`\n### ${ds.label}`);
    lines.push(`Meses: ${d.months.join(', ')}`);

    if (d.vendasNovos) lines.push(`Vendas Novos: ${d.vendasNovos.vendas?.join(', ')}`);
    if (d.vendasUsados) lines.push(`Vendas Usados: ${d.vendasUsados.vendas?.join(', ')}`);
    if (d.vendasNovosVD) lines.push(`Vendas Novos VD: ${d.vendasNovosVD.vendas?.join(', ')}`);
    if (d.estoqueNovos) {
      lines.push(`Estoque Novos (qtde): ${d.estoqueNovos.quantidade?.join(', ')}`);
      lines.push(`Estoque Novos (valor R$): ${d.estoqueNovos.valor?.map(fmtNum).join(', ')}`);
    }
    if (d.estoqueUsados) {
      lines.push(`Estoque Usados (qtde): ${d.estoqueUsados.quantidade?.join(', ')}`);
      lines.push(`Estoque Usados (valor R$): ${d.estoqueUsados.valor?.map(fmtNum).join(', ')}`);
    }
    if (d.estoquePecas) {
      lines.push(`Estoque Peças (valor R$): ${d.estoquePecas.valor?.map(fmtNum).join(', ')}`);
    }
  }

  return lines.join('\n');
}

async function buildFullContext(
  data: any,
  selectedMonth: number,
  selectedYear: number,
  prevMonthAccounts: Record<string, any> | null,
  janAccounts: Record<string, any> | null,
): Promise<string> {
  const parts: string[] = [];

  parts.push(`# Dados Financeiros — Grupo Sorana (Concessionária VW/Audi)`);
  parts.push(`Período principal: ${MONTH_NAMES[selectedMonth] || 'Anual'}/${selectedYear}`);

  // 1. Balancete atual
  if (data?.accounts) {
    parts.push(buildAccountsSummary(data.accounts, `Balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear}`));
  }

  // 2. Mês anterior
  if (prevMonthAccounts) {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    parts.push(buildAccountsSummary(prevMonthAccounts, `Balancete Mês Anterior — ${MONTH_NAMES[prevMonth]}/${prevYear}`));
  }

  // 3. Janeiro (para YTD)
  if (janAccounts && selectedMonth > 1) {
    parts.push(buildAccountsSummary(janAccounts, `Balancete Janeiro/${selectedYear} (base acumulado)`));
  }

  // 4. Carregar outros meses disponíveis do KV
  try {
    const index = await loadFluxoCaixaIndex();
    const otherKeys = Object.keys(index).filter(k => {
      const [y, m] = k.split('_').map(Number);
      return !(y === selectedYear && m === selectedMonth);
    });
    // Load up to 3 additional months for context
    const toLoad = otherKeys.slice(0, 3);
    for (const key of toLoad) {
      const [y, m] = key.split('_').map(Number);
      const raw = await loadFluxoCaixaRaw(y, m);
      if (raw?.rawText) {
        const parsed = parseBalanceteForContext(raw.rawText);
        parts.push(buildAccountsSummary(parsed, `Balancete ${MONTH_NAMES[m]}/${y}`));
      }
    }
  } catch {
    // Silently continue without additional months
  }

  // 5. Métricas VW (Dashboard Operacional)
  parts.push(buildVWMetricsSummary());

  return parts.join('\n');
}

// ─── Configuração do marked ─────────────────────────────────────────────────
marked.setOptions({ gfm: true, breaks: true });

// ─── Componente ─────────────────────────────────────────────────────────────
export function PerguntasRespostasTab({ data, selectedMonth, selectedYear, prevMonthAccounts, janAccounts }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build context on mount / when data changes
  useEffect(() => {
    setContextReady(false);
    buildFullContext(data, selectedMonth, selectedYear, prevMonthAccounts, janAccounts)
      .then(ctx => {
        contextRef.current = ctx;
        setContextReady(true);
      })
      .catch(() => setContextReady(true));
  }, [data, selectedMonth, selectedYear, prevMonthAccounts, janAccounts]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context: contextRef.current }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Erro ao processar a pergunta');
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${json.error || 'Erro ao processar a pergunta'}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.answer }]);
      }
    } catch {
      setError('Erro de conexão com o servidor');
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erro de conexão com o servidor. Tente novamente.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const SUGGESTIONS = [
    'Qual o resultado líquido do mês e como se compara ao mês anterior?',
    'Quais as principais despesas operacionais e como variaram?',
    'Qual a posição do endividamento bancário?',
    'Como está o estoque de veículos novos e usados?',
    'Qual o fluxo de caixa do mês?',
    'Quais são os principais indicadores de saúde financeira?',
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Perguntas e Respostas</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pergunte sobre qualquer dado financeiro do app — IA com acesso a todos os dados
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-red-300 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className={`w-2 h-2 rounded-full ${contextReady ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
        {contextReady ? `Contexto carregado — ${MONTH_NAMES[selectedMonth]}/${selectedYear}` : 'Preparando contexto dos dados...'}
      </div>

      {/* Chat area */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Sparkles className="w-12 h-12 text-purple-300 dark:text-purple-500 mb-4" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Como posso ajudar?</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                Faça perguntas sobre os dados financeiros do grupo Sorana. Tenho acesso a balancetes, métricas de vendas, estoques e mais.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div
                      className="text-sm prose prose-sm dark:prose-invert max-w-none prose-table:text-xs prose-th:p-1 prose-td:p-1"
                      dangerouslySetInnerHTML={{ __html: marked(msg.content) as string }}
                    />
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Analisando dados...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          {error && (
            <div className="mb-2 text-xs text-red-500">{error}</div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Faça uma pergunta sobre os dados financeiros..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              style={{ maxHeight: 120, minHeight: 44 }}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || !contextReady}
              className="shrink-0 w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white flex items-center justify-center transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            Pressione Enter para enviar • Shift+Enter para nova linha • Respostas geradas por IA com base nos dados do app
          </p>
        </div>
      </div>
    </div>
  );
}
