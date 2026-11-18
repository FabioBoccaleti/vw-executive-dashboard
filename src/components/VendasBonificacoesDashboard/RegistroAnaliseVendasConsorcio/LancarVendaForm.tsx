import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  loadCadastroConsorcio,
  parsePercentualCadastro,
  type CadastroConsorcio,
} from './cadastroStorage';
import { calcularComissaoVendedor, validarCronograma } from './comissaoVendedor';
import { criarVendaConsorcio, saveNovaVendaConsorcio } from './vendasStorage';
import { formatCurrency, parseValorMonetario } from './valores';

function parsePercent(value: string): number {
  return parsePercentualCadastro(value) ?? 0;
}

function formatPercentLabel(value: string): string {
  return `${value.trim().replace(/\s*%+$/, '') || '0'}%`;
}

function getRegraBaseLabel(base: 'valor_carta' | 'bruta' | 'liquida'): string {
  if (base === 'valor_carta') return 'Valor da carta';
  return base === 'bruta' ? 'Comissão Sorana bruta' : 'Comissão Sorana líquida';
}

export function LancarVendaForm({ onOpenCadastros, onVendaRegistrada }: {
  onOpenCadastros: () => void;
  onVendaRegistrada?: () => void;
}) {
  const [cadastro, setCadastro] = useState<CadastroConsorcio | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [dataVenda, setDataVenda] = useState('');
  const [cliente, setCliente] = useState('');
  const [grupoCota, setGrupoCota] = useState('');
  const [valorCarta, setValorCarta] = useState('');
  const [registroId, setRegistroId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      setCadastro(await loadCadastroConsorcio());
    } catch (error) {
      setLoadError(String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const produto = useMemo(
    () => cadastro?.produtos.find(item => item.id === produtoId),
    [cadastro, produtoId],
  );
  const vendedor = useMemo(
    () => cadastro?.vendedores.find(item => item.id === vendedorId),
    [cadastro, vendedorId],
  );
  const cargo = cadastro?.cargos.find(item => item.id === vendedor?.cargoId);
  const regra = produto && vendedor
    ? cadastro?.regrasComissao.find(item => item.produtoId === produto.id && item.cargoId === vendedor.cargoId)
    : undefined;

  const valorCartaParseado = parseValorMonetario(valorCarta);
  const valorCartaNumero = valorCartaParseado ?? 0;
  const valorCartaValido = valorCartaParseado !== null;
  const valorCartaInvalido = valorCarta.trim() !== '' && !valorCartaValido;
  const valorSoranaBruto = valorCartaValido && produto
    ? valorCartaNumero * parsePercent(produto.percentualSorana) / 100
    : 0;
  const aliquota = parsePercent(cadastro?.aliquotaImposto ?? '');
  const valorImposto = valorSoranaBruto * aliquota / 100;
  const valorSoranaLiquido = valorSoranaBruto - valorImposto;
  const erroCronograma = regra && produto ? validarCronograma(regra, produto.parcelasSorana) : null;
  const comissaoVendedor = regra && produto && valorCartaValido && !erroCronograma
    ? calcularComissaoVendedor(regra, produto, valorCartaNumero, aliquota)
    : null;
  const podeRegistrar = Boolean(dataVenda && cliente.trim() && grupoCota.trim() && produto && vendedor && regra && valorCartaValido && valorCartaNumero > 0 && !erroCronograma);

  async function registrar() {
    if (!cadastro || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const venda = criarVendaConsorcio({
        id: registroId, dataVenda, cliente, grupoCota, valorCarta: valorCartaValido ? valorCartaNumero : NaN, produtoId, vendedorId,
      }, cadastro);
      await saveNovaVendaConsorcio(venda);
      toast.success('Venda registrada. As parcelas da Sorana estão disponíveis em Vendas.');
      setRegistroId(crypto.randomUUID());
      setDataVenda('');
      setCliente('');
      setGrupoCota('');
      setValorCarta('');
      setProdutoId('');
      setVendedorId('');
      onVendaRegistrada?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      toast.error(`Não foi possível registrar a venda: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex-1 p-8 text-center text-sm text-slate-400">Carregando dados do cadastro...</div>;
  }

  if (loadError || !cadastro) {
    return (
      <div className="flex-1 p-4">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-white p-6">
          <div className="flex items-start gap-3 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Não foi possível carregar os cadastros de consórcio.</p>
              <p className="mt-1 break-words text-xs">{loadError}</p>
            </div>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const semProdutos = cadastro.produtos.length === 0;
  const semVendedores = cadastro.vendedores.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <fieldset disabled={saving} className="mx-auto min-w-0 max-w-6xl space-y-4">
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-900">
          Ao registrar, as parcelas brutas da comissão da Sorana serão geradas em Vendas, sem vencimento. O imposto é controlado separadamente.
        </div>

        {(semProdutos || semVendedores) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-white p-4">
            <div className="text-sm text-slate-700">
              {semProdutos && <p>Cadastre produtos de consórcio antes de lançar uma venda.</p>}
              {semVendedores && <p>Cadastre vendedores e seus cargos para configurar as comissões.</p>}
            </div>
            <Button variant="outline" onClick={onOpenCadastros}>Abrir cadastro</Button>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-slate-800">Dados da venda</h2>
          <p className="mb-5 text-xs text-slate-500">Informe os dados do contrato. Produto e vendedor usam as opções cadastradas.</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Data da venda *">
              <Input type="date" value={dataVenda} onChange={event => setDataVenda(event.target.value)} />
            </Field>
            <Field label="Produto / tipo de carta *">
              <select value={produtoId} onChange={event => setProdutoId(event.target.value)} disabled={semProdutos} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Selecione o produto...</option>
                {cadastro.produtos.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </Field>
            <Field label="Vendedor *">
              <select value={vendedorId} onChange={event => setVendedorId(event.target.value)} disabled={semVendedores} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Selecione o vendedor...</option>
                {cadastro.vendedores.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
              {vendedor && <span className="mt-1 block text-xs text-slate-500">Cargo: {cargo?.nome ?? 'não encontrado'}</span>}
            </Field>
            <Field label="Cliente *">
              <Input value={cliente} onChange={event => setCliente(event.target.value)} placeholder="Nome do cliente" />
            </Field>
            <Field label="Grupo / cota *">
              <Input value={grupoCota} onChange={event => setGrupoCota(event.target.value)} placeholder="Ex.: grupo 123 / cota 456" />
            </Field>
            <Field label="Valor da carta de crédito *">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-slate-500">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valorCarta}
                  onChange={event => setValorCarta(event.target.value)}
                  onBlur={() => {
                    if (valorCartaValido) {
                      setValorCarta(valorCartaNumero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    }
                  }}
                  aria-invalid={valorCartaInvalido}
                  aria-describedby={valorCartaInvalido ? 'valor-carta-erro' : undefined}
                  placeholder="0,00"
                  className="pl-10 text-right"
                />
              </div>
              {valorCartaInvalido && <span id="valor-carta-erro" role="alert" className="mt-1 block text-xs text-red-700">Informe um valor válido, maior ou igual a zero.</span>}
            </Field>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="mb-1 text-sm font-bold text-slate-800">Valores calculados pelo cadastro</h3>
            <p className="mb-4 text-xs text-slate-500">Os valores são preenchidos automaticamente conforme o produto, o cargo do vendedor e as regras cadastradas.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Comissão bruta da Sorana">
                <Input value={valorCartaValido && produto ? formatCurrency(valorSoranaBruto) : ''} placeholder="Selecione o produto e informe o valor da carta" readOnly className="bg-slate-50 text-slate-700" />
              </Field>
              <Field label={`Imposto (${formatPercentLabel(cadastro.aliquotaImposto)})`}>
                <Input value={valorCartaValido && produto ? formatCurrency(valorImposto) : ''} placeholder="Calculado pelo cadastro" readOnly className="bg-slate-50 text-slate-700" />
              </Field>
              <Field label="Comissão líquida da Sorana">
                <Input value={valorCartaValido && produto ? formatCurrency(valorSoranaLiquido) : ''} placeholder="Comissão bruta menos imposto" readOnly className="bg-slate-50 text-slate-700" />
              </Field>
              <Field label="Valor total da remuneração do vendedor">
                <Input
                  value={comissaoVendedor ? formatCurrency(comissaoVendedor.total) : ''}
                  placeholder={regra ? 'Informe o valor da carta' : 'Cadastre a regra para cargo e produto'}
                  readOnly
                  className="bg-slate-50 font-semibold text-cyan-800"
                />
                {regra && <span className="mt-1 block text-xs text-slate-500">{regra.pagamento === 'cronograma' ? 'Cronograma por parcela' : formatPercentLabel(regra.percentual)} sobre {getRegraBaseLabel(regra.base)}</span>}
                {erroCronograma && <span role="alert" className="mt-1 block text-xs text-red-700">{erroCronograma} Corrija a regra no cadastro.</span>}
              </Field>
              <Field label="Parcelas em que a Sorana receberá a comissão">
                <Input
                  value={produto ? `${produto.parcelasSorana} ${produto.parcelasSorana === 1 ? 'parcela' : 'parcelas'}` : ''}
                  placeholder="Definidas pelo produto"
                  readOnly
                  className="bg-slate-50 text-slate-700"
                />
              </Field>
            </div>
            {regra?.pagamento === 'cronograma' && comissaoVendedor && (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <caption className="p-3 text-left text-xs text-slate-600">
                    Remuneração do vendedor por parcela. Bases bruta e líquida consideram somente a parcela correspondente da Sorana.
                  </caption>
                  <thead className="bg-cyan-800 text-white"><tr>
                    <th className="px-4 py-2 text-left">Parcela</th>
                    <th className="px-4 py-2 text-right">Percentual</th>
                    <th className="px-4 py-2 text-right">Comissão do vendedor</th>
                  </tr></thead>
                  <tbody>{comissaoVendedor.parcelas.map((valor, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-4 py-2">{index + 1}ª</td>
                      <td className="px-4 py-2 text-right">{formatPercentLabel(regra.percentuaisParcelas?.[index] ?? '0')}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(valor)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Preencha todos os campos obrigatórios. As condições do cadastro serão preservadas nesta venda.</p>
          <Button disabled={saving || !podeRegistrar} onClick={() => void registrar()} className="bg-cyan-700 text-white">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Registrando...' : 'Registrar venda'}
          </Button>
        </div>
        {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
      </fieldset>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
