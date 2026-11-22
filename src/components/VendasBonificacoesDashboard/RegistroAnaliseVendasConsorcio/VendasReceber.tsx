import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  estornarRecebimentoConsorcio, loadVendasConsorcio, recebidoParcela, registrarRecebimentoConsorcio, resumoVenda, saldoParcela,
  type ParcelaConsorcio, type RecebimentoConsorcio, type VendaConsorcio,
} from './vendasStorage';
import { dataValida, emCentavos, formatCurrency, parseValorMonetario } from './valores';

const moeda = (centavos: number) => formatCurrency(centavos / 100);
const dataBR = (data: string) => data.split('-').reverse().join('/');
const resumoRecebimento = (item: RecebimentoConsorcio) => `${dataBR(item.data)} — ${moeda(item.valorCentavos)}`;
const historicoRecebimento = (item: RecebimentoConsorcio) =>
  `${resumoRecebimento(item)}${item.numeroBordero ? ` — Borderô: ${item.numeroBordero}` : ''}`;

function hoje(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface Baixa {
  id: string;
  vendaId: string;
  cliente: string;
  parcela: number;
  saldoCentavos: number;
}

interface Estorno {
  vendaId: string;
  cliente: string;
  parcela: number;
  recebimento: RecebimentoConsorcio;
}

export function VendasReceber({ situacao }: { situacao: 'a_receber' | 'recebida' }) {
  const [vendas, setVendas] = useState<VendaConsorcio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [baixa, setBaixa] = useState<Baixa | null>(null);
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [numeroBordero, setNumeroBordero] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [estorno, setEstorno] = useState<Estorno | null>(null);
  const [senha, setSenha] = useState('');

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      setVendas(await loadVendasConsorcio());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(message);
      toast.error(`Erro ao carregar as vendas: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function abrirRecebimento(venda: VendaConsorcio, parcela: ParcelaConsorcio) {
    const saldoCentavos = saldoParcela(parcela);
    setBaixa({ id: crypto.randomUUID(), vendaId: venda.id, cliente: venda.cliente, parcela: parcela.numero, saldoCentavos });
    setValor((saldoCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setData(hoje());
    setNumeroBordero('');
    setSaveError('');
  }

  async function confirmarRecebimento() {
    if (!baixa || saving) return;
    setSaveError('');
    const parsed = parseValorMonetario(valor);
    if (parsed === null || !dataValida(data)) {
      setSaveError('Informe um valor e uma data de recebimento válidos.');
      return;
    }
    if (!numeroBordero.trim()) {
      setSaveError('Informe o número do borderô.');
      return;
    }
    setSaving(true);
    try {
      const atualizada = await registrarRecebimentoConsorcio(baixa.vendaId, baixa.parcela, {
        id: baixa.id, data, valorCentavos: emCentavos(parsed), numeroBordero,
      });
      setVendas(current => current.map(item => item.id === atualizada.id ? atualizada : item));
      setBaixa(null);
      toast.success(resumoVenda(atualizada).quitada
        ? 'Venda totalmente recebida. Todas as parcelas estão disponíveis na aba Recebida.'
        : 'Recebimento disponível na aba Recebida. O saldo restante permanece em A Receber.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      toast.error(`Não foi possível registrar o recebimento: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  function abrirEstorno(venda: VendaConsorcio, parcela: ParcelaConsorcio, recebimento: RecebimentoConsorcio) {
    setEstorno({ vendaId: venda.id, cliente: venda.cliente, parcela: parcela.numero, recebimento });
    setSenha('');
    setSaveError('');
  }

  async function confirmarEstorno() {
    if (!estorno || saving) return;
    setSaveError('');
    setSaving(true);
    try {
      const atualizada = await estornarRecebimentoConsorcio(estorno.vendaId, estorno.parcela, estorno.recebimento.id, senha);
      setVendas(current => current.map(item => item.id === atualizada.id ? atualizada : item));
      setEstorno(null);
      setSenha('');
      toast.success('Recebimento estornado. O valor voltou para A Receber.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      toast.error(`Não foi possível estornar o recebimento: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  const totalBruto = vendas.reduce((sum, venda) => sum + venda.comissaoBrutaCentavos, 0);
  const totalRecebido = vendas.reduce((sum, venda) => sum + resumoVenda(venda).recebidoCentavos, 0);
  const pendentes = vendas.filter(venda => !resumoVenda(venda).quitada);
  const parcelasRecebidas = vendas.flatMap(venda => venda.parcelas
    .filter(parcela => recebidoParcela(parcela) > 0)
    .map(parcela => ({ venda, parcela })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Comissões da Sorana — contas a receber</h2>
          <p className="text-xs text-slate-500">Parcelas brutas, sem vencimento. Imposto separado. Recebida mostra as parcelas com recebimentos, inclusive parciais. Vendas com saldo continuam em A Receber.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || saving}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Carregando vendas...</p>
        : loadError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar as vendas: {loadError}. Use Atualizar para tentar novamente.</p>
          : <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Comissão bruta total', total: totalBruto },
                { label: 'Total recebido', total: totalRecebido },
                { label: 'Saldo a receber', total: totalBruto - totalRecebido },
              ].map(({ label, total }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{label} · todas as vendas</p>
                  <p className="mt-1 text-xl font-bold text-cyan-800">{moeda(total)}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {situacao === 'recebida' ? (
                <table className="w-full min-w-[1050px] text-sm" aria-label="Parcelas com recebimentos">
                  <thead className="bg-cyan-800 text-white"><tr>
                    {['Data da venda', 'Data do recebimento', 'Número do borderô', 'Cliente / Grupo e cota', 'Produto', 'Valor da carta', 'Parcela', 'Valor previsto', 'Recebido', 'Saldo', 'Situação', 'Histórico de recebimentos', 'Ação'].map(label => (
                      <th key={label} className="px-4 py-3 text-left text-xs">{label}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {parcelasRecebidas.length === 0 && <tr><td colSpan={13} className="p-10 text-center text-slate-400">Nenhuma parcela com recebimento.</td></tr>}
                    {parcelasRecebidas.map(({ venda, parcela }) => (
                      <tr key={`${venda.id}-${parcela.numero}`} className="border-t border-slate-100">
                        <td className="px-4 py-3">{dataBR(venda.dataVenda)}</td>
                        <td className="px-4 py-3 align-top">{parcela.recebimentos.map(item => (
                          <div key={item.id} className="flex h-8 items-center whitespace-nowrap">{dataBR(item.data)}</div>
                        ))}</td>
                        <td className="px-4 py-3">{parcela.recebimentos.map(item => item.numeroBordero || '—').join(' · ')}</td>
                        <td className="px-4 py-3"><p className="font-semibold">{venda.cliente}</p><p className="text-xs text-slate-500">{venda.grupoCota}</p></td>
                        <td className="px-4 py-3">{venda.produto.nome}</td>
                        <td className="whitespace-nowrap px-4 py-3">{moeda(venda.valorCartaCentavos)}</td>
                        <td className="px-4 py-3">{parcela.numero}/{venda.parcelas.length}</td>
                        <td className="whitespace-nowrap px-4 py-3">{moeda(parcela.valorCentavos)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-emerald-700">{moeda(recebidoParcela(parcela))}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{moeda(saldoParcela(parcela))}</td>
                        <td className="px-4 py-3">{saldoParcela(parcela) === 0 ? 'Recebida' : 'Parcial'}</td>
                        <td className="px-4 py-3 align-top text-xs text-slate-500">{parcela.recebimentos.map(item => (
                          <div key={item.id} className="flex h-8 items-center whitespace-nowrap">{resumoRecebimento(item)}</div>
                        ))}</td>
                        <td className="px-4 py-3 align-top">{parcela.recebimentos.map(item => (
                          <div key={item.id} className="flex h-8 items-center">
                            <Button size="sm" variant="outline" disabled={saving} onClick={() => abrirEstorno(venda, parcela, item)} aria-label={`Estornar recebimento de ${venda.cliente}, parcela ${parcela.numero}, ${historicoRecebimento(item)}`}>Estornar</Button>
                          </div>
                        ))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-cyan-800 text-white"><tr>
                  {['Data da venda', 'Cliente / Grupo e cota', 'Produto', 'Valor da carta', 'Comissão bruta Sorana', 'Parcelas quitadas', 'Recebido', 'Saldo', 'Detalhes'].map(label => (
                    <th key={label} className="px-4 py-3 text-left text-xs">{label}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {pendentes.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-slate-400">Nenhuma venda a receber.</td></tr>}
                  {pendentes.map(venda => {
                    const resumo = resumoVenda(venda);
                    return (
                      <Fragment key={venda.id}>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-3">{dataBR(venda.dataVenda)}</td>
                          <td className="px-4 py-3"><p className="font-semibold">{venda.cliente}</p><p className="text-xs text-slate-500">{venda.grupoCota}</p></td>
                          <td className="px-4 py-3">{venda.produto.nome}</td>
                          <td className="whitespace-nowrap px-4 py-3">{moeda(venda.valorCartaCentavos)}</td>
                          <td className="whitespace-nowrap px-4 py-3">{moeda(venda.comissaoBrutaCentavos)}</td>
                          <td className="px-4 py-3">{resumo.parcelasRecebidas}/{venda.parcelas.length}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-emerald-700">{moeda(resumo.recebidoCentavos)}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">{moeda(resumo.saldoCentavos)}</td>
                          <td className="px-4 py-3"><Button size="sm" variant="outline" aria-label={`Parcelas de ${venda.cliente}`} aria-expanded={expanded === venda.id} onClick={() => setExpanded(expanded === venda.id ? null : venda.id)}>
                            {expanded === venda.id ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}Parcelas
                          </Button></td>
                        </tr>
                        {expanded === venda.id && <tr><td colSpan={9} className="bg-slate-50 p-4">
                          <p className="mb-3 text-xs text-slate-600">Imposto previsto: {moeda(venda.impostoCentavos)} · Comissão líquida prevista: {moeda(venda.comissaoLiquidaCentavos)}. O recebimento é controlado pelo valor bruto.</p>
                          <table className="w-full bg-white text-sm" aria-label={`Parcelas de ${venda.cliente}`}>
                            <thead className="bg-cyan-50 text-cyan-900"><tr>{['Parcela', 'Valor previsto', 'Recebido', 'Saldo', 'Situação', 'Ação'].map(label => <th key={label} className="px-3 py-2 text-left text-xs">{label}</th>)}</tr></thead>
                            <tbody>{venda.parcelas.map(parcela => {
                              const recebido = recebidoParcela(parcela);
                              const saldo = saldoParcela(parcela);
                              return <Fragment key={parcela.numero}>
                                <tr className="border-t border-slate-100">
                                  <td className="px-3 py-2">{parcela.numero}/{venda.parcelas.length}</td>
                                  <td className="px-3 py-2">{moeda(parcela.valorCentavos)}</td>
                                  <td className="px-3 py-2">{moeda(recebido)}</td>
                                  <td className="px-3 py-2">{moeda(saldo)}</td>
                                  <td className="px-3 py-2">{saldo === 0 ? 'Recebida' : recebido > 0 ? 'Parcial' : 'Pendente'}</td>
                                  <td className="px-3 py-2">{saldo > 0 && <Button size="sm" onClick={() => abrirRecebimento(venda, parcela)}>Registrar recebimento</Button>}</td>
                                </tr>
                                {parcela.recebimentos.length > 0 && <tr><td colSpan={6} className="px-3 pb-3 text-xs text-slate-500">
                                  Histórico: {parcela.recebimentos.map(historicoRecebimento).join(' · ')}
                                </td></tr>}
                              </Fragment>;
                            })}</tbody>
                          </table>
                        </td></tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
          </>}

      <Dialog open={baixa !== null} onOpenChange={open => { if (!open && !saving) setBaixa(null); }}>
        <DialogContent onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onInteractOutside={event => { if (saving) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
            <DialogDescription>{baixa?.cliente} · Parcela {baixa?.parcela}. Saldo disponível: {moeda(baixa?.saldoCentavos ?? 0)}. Para recebimento parcial, informe apenas o valor recebido.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={saving} className="space-y-4">
            <label className="block text-sm">Valor recebido (R$)
              <Input value={valor} onChange={event => setValor(event.target.value)} inputMode="decimal" className="mt-1" />
            </label>
            <label className="block text-sm">Data do recebimento
              <Input type="date" value={data} onChange={event => setData(event.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm">Número do borderô *
              <Input value={numeroBordero} onChange={event => setNumeroBordero(event.target.value)} required className="mt-1" />
            </label>
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setBaixa(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={() => void confirmarRecebimento()}>{saving ? 'Salvando...' : 'Confirmar recebimento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={estorno !== null} onOpenChange={open => { if (!open && !saving) { setEstorno(null); setSenha(''); } }}>
        <DialogContent onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onInteractOutside={event => { if (saving) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Estornar recebimento</DialogTitle>
            <DialogDescription>
              {estorno?.cliente} · Parcela {estorno?.parcela} · {estorno && historicoRecebimento(estorno.recebimento)}. O recebimento será removido e o valor voltará para A Receber.
            </DialogDescription>
          </DialogHeader>
          <label className="block text-sm">Senha de estorno
            <Input type="password" autoComplete="off" value={senha} onChange={event => setSenha(event.target.value)} disabled={saving} className="mt-1" />
          </label>
          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => { setEstorno(null); setSenha(''); }}>Cancelar</Button>
            <Button disabled={saving} onClick={() => void confirmarEstorno()}>{saving ? 'Salvando...' : 'Confirmar estorno'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
