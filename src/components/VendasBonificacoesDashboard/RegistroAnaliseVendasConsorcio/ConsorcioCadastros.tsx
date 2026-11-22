import { useEffect, useState } from 'react';
import { BookOpen, BriefcaseBusiness, Receipt, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  loadCadastroConsorcio,
  parsePercentualCadastro,
  saveCadastroConsorcio,
  type CadastroConsorcio,
  type CargoConsorcio,
  type ProdutoConsorcio,
  type RegraComissaoConsorcio,
  type VendedorConsorcio,
} from './cadastroStorage';
import { BASE_COMISSAO_LABELS, validarCronograma } from './comissaoVendedor';

type SecaoCadastro = 'produtos' | 'equipe' | 'impostos';

const SECOES: { id: SecaoCadastro; label: string; icon: React.ReactNode }[] = [
  { id: 'produtos', label: 'Produtos e comissões', icon: <BriefcaseBusiness className="w-4 h-4" /> },
  { id: 'equipe', label: 'Cargos e vendedores', icon: <Users className="w-4 h-4" /> },
  { id: 'impostos', label: 'Alíquota de imposto', icon: <Receipt className="w-4 h-4" /> },
];

function isValidPercent(value: string): boolean {
  const parsed = parsePercentualCadastro(value);
  return parsed !== null && parsed >= 0 && parsed <= 100;
}

function validateCadastro(data: CadastroConsorcio): { message: string; secao: SecaoCadastro } | null {
  for (const regra of data.regrasComissao) {
    const produto = data.produtos.find(item => item.id === regra.produtoId);
    if (!produto) return { message: 'Produto da regra de comissão não encontrado.', secao: 'produtos' };
    const erro = validarCronograma(regra, produto.parcelasSorana);
    if (erro) return { message: erro, secao: 'produtos' };
  }
  if (data.regrasComissao.some(regra => regra.base === 'liquida') && !isValidPercent(data.aliquotaImposto)) {
    return { message: 'Informe uma alíquota de imposto válida para usar a base líquida.', secao: 'impostos' };
  }
  return null;
}

export function ConsorcioCadastros() {
  const [data, setData] = useState<CadastroConsorcio | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [secao, setSecao] = useState<SecaoCadastro>('produtos');

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      setData(await loadCadastroConsorcio());
    } catch (error) {
      const message = String(error);
      setLoadError(message);
      toast.error(`Erro ao carregar os cadastros de consórcio: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(patch: Partial<CadastroConsorcio>) {
    setData(current => current ? { ...current, ...patch } : current);
    setDirty(true);
  }

  async function save() {
    if (!data) return;
    const validationError = validateCadastro(data);
    if (validationError) {
      toast.error(validationError.message);
      setSecao(validationError.secao);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveCadastroConsorcio(data);
      if (!saved) {
        toast.error('Erro ao salvar os cadastros. Verifique sua conexão e tente novamente.');
        return;
      }
      setDirty(false);
      toast.success('Cadastros de consórcio salvos.');
    } catch (error) {
      toast.error(`Erro ao salvar os cadastros: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex-1 p-8 text-center text-sm text-slate-400">Carregando cadastros...</div>;
  }

  if (loadError || !data) {
    return (
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>Não foi possível carregar os cadastros de consórcio.</p>
          <p className="mt-1 break-words text-xs">{loadError}</p>
          <Button className="mt-4" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-64 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <nav className="space-y-1 p-3" aria-label="Seções do cadastro de consórcio">
          {SECOES.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSecao(item.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${
                secao === item.id ? 'bg-cyan-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan-700" />
              <h2 className="text-lg font-bold text-slate-800">
                {SECOES.find(item => item.id === secao)?.label}
              </h2>
            </div>
            <Button onClick={() => void save()} disabled={saving || !dirty} className="bg-cyan-700 text-white hover:bg-cyan-800">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>

          {secao === 'produtos' && (
            <ProdutosSection
              produtos={data.produtos}
              cargos={data.cargos}
              regras={data.regrasComissao}
              disabled={saving}
              onProdutosChange={produtos => update({ produtos })}
              onRegrasChange={regrasComissao => update({ regrasComissao })}
            />
          )}
          {secao === 'equipe' && (
            <EquipeSection
              cargos={data.cargos}
              vendedores={data.vendedores}
              regras={data.regrasComissao}
              disabled={saving}
              onCargosChange={cargos => update({ cargos })}
              onVendedoresChange={vendedores => update({ vendedores })}
            />
          )}
          {secao === 'impostos' && (
            <ImpostosSection
              aliquota={data.aliquotaImposto}
              hasBaseLiquida={data.regrasComissao.some(regra => regra.base === 'liquida')}
              disabled={saving}
              onChange={aliquotaImposto => update({ aliquotaImposto })}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ProdutosSection({
  produtos,
  cargos,
  regras,
  disabled,
  onProdutosChange,
  onRegrasChange,
}: {
  produtos: ProdutoConsorcio[];
  cargos: CargoConsorcio[];
  regras: RegraComissaoConsorcio[];
  disabled: boolean;
  onProdutosChange: (items: ProdutoConsorcio[]) => void;
  onRegrasChange: (items: RegraComissaoConsorcio[]) => void;
}) {
  const [nome, setNome] = useState('');
  const [percentualSorana, setPercentualSorana] = useState('');
  const [parcelasSorana, setParcelasSorana] = useState(1);
  const [editingProduct, setEditingProduct] = useState<ProdutoConsorcio | null>(null);
  const [novoCargoId, setNovoCargoId] = useState('');
  const [novoProdutoId, setNovoProdutoId] = useState('');
  const [novoPercentual, setNovoPercentual] = useState('');
  const [novaBase, setNovaBase] = useState<RegraComissaoConsorcio['base']>('bruta');
  const [novoPagamento, setNovoPagamento] = useState<RegraComissaoConsorcio['pagamento']>('por_parcela');
  const [novosPercentuaisParcelas, setNovosPercentuaisParcelas] = useState<string[]>([]);
  const [editingRule, setEditingRule] = useState<RegraComissaoConsorcio | null>(null);

  function addProduct() {
    const trimmedName = nome.trim();
    if (!trimmedName) { toast.error('Informe o nome do produto.'); return; }
    if (produtos.some(item => item.nome.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      toast.error('Já existe um produto com esse nome.');
      return;
    }
    if (!isValidPercent(percentualSorana)) { toast.error('Informe uma remuneração válida entre 0 e 100%.'); return; }
    onProdutosChange([...produtos, {
      id: crypto.randomUUID(),
      nome: trimmedName,
      percentualSorana: percentualSorana.trim(),
      parcelasSorana,
    }]);
    setNome('');
    setPercentualSorana('');
    setParcelasSorana(1);
  }

  function saveProductEdit() {
    if (!editingProduct) return;
    const trimmedName = editingProduct.nome.trim();
    if (!trimmedName) { toast.error('Informe o nome do produto.'); return; }
    if (produtos.some(item => item.id !== editingProduct.id && item.nome.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      toast.error('Já existe um produto com esse nome.');
      return;
    }
    if (!isValidPercent(editingProduct.percentualSorana)) { toast.error('Informe uma remuneração válida entre 0 e 100%.'); return; }
    const cronogramas = regras.filter(regra => regra.produtoId === editingProduct.id && regra.pagamento === 'cronograma');
    if (cronogramas.some(regra => regra.percentuaisParcelas?.slice(editingProduct.parcelasSorana).some(value => parsePercentualCadastro(value) !== 0))) {
      toast.error('Existem comissões nas parcelas que serão removidas. Ajuste os cronogramas antes de reduzir as parcelas do produto.');
      return;
    }
    if (cronogramas.length > 0) {
      onRegrasChange(regras.map(regra => regra.produtoId === editingProduct.id && regra.pagamento === 'cronograma'
        ? { ...regra, percentuaisParcelas: Array.from({ length: editingProduct.parcelasSorana }, (_, index) => regra.percentuaisParcelas?.[index] ?? '0') }
        : regra));
    }
    onProdutosChange(produtos.map(item => item.id === editingProduct.id
      ? { ...editingProduct, nome: trimmedName, percentualSorana: editingProduct.percentualSorana.trim() }
      : item));
    if (novoProdutoId === editingProduct.id) {
      setNovosPercentuaisParcelas(current => Array.from({ length: editingProduct.parcelasSorana }, (_, index) => current[index] ?? '0'));
    }
    setEditingProduct(null);
  }

  function removeProduct(id: string) {
    if (regras.some(regra => regra.produtoId === id)) {
      toast.error('Remova primeiro as regras de comissão vinculadas a este produto.');
      return;
    }
    onProdutosChange(produtos.filter(item => item.id !== id));
  }

  function addRule() {
    if (!novoCargoId || !novoProdutoId) { toast.error('Selecione o cargo e o produto.'); return; }
    if (novoPagamento !== 'cronograma' && !isValidPercent(novoPercentual)) { toast.error('Informe um percentual de comissão válido entre 0 e 100%.'); return; }
    if (regras.some(regra => regra.cargoId === novoCargoId && regra.produtoId === novoProdutoId)) {
      toast.error('Já existe uma regra para este cargo e produto.');
      return;
    }
    const regra: RegraComissaoConsorcio = {
      id: crypto.randomUUID(),
      cargoId: novoCargoId,
      produtoId: novoProdutoId,
      percentual: novoPagamento === 'cronograma' ? '0' : novoPercentual.trim(),
      base: novaBase,
      pagamento: novoPagamento,
      ...(novoPagamento === 'cronograma' ? { percentuaisParcelas: novosPercentuaisParcelas } : {}),
    };
    const produto = produtos.find(item => item.id === novoProdutoId);
    if (!produto) { toast.error('Selecione um produto válido.'); return; }
    const erro = validarCronograma(regra, produto.parcelasSorana);
    if (erro) { toast.error(erro); return; }
    onRegrasChange([...regras, regra]);
    setNovoPercentual('');
  }

  function saveRuleEdit() {
    if (!editingRule) return;
    if (!editingRule.cargoId || !editingRule.produtoId) { toast.error('Selecione o cargo e o produto.'); return; }
    if (editingRule.pagamento !== 'cronograma' && !isValidPercent(editingRule.percentual)) { toast.error('Informe um percentual de comissão válido entre 0 e 100%.'); return; }
    const produto = produtos.find(item => item.id === editingRule.produtoId);
    if (!produto) { toast.error('Selecione um produto válido.'); return; }
    const erro = validarCronograma(editingRule, produto.parcelasSorana);
    if (erro) { toast.error(erro); return; }
    if (regras.some(regra => regra.id !== editingRule.id && regra.cargoId === editingRule.cargoId && regra.produtoId === editingRule.produtoId)) {
      toast.error('Já existe uma regra para este cargo e produto.');
      return;
    }
    onRegrasChange(regras.map(regra => regra.id === editingRule.id ? editingRule : regra));
    setEditingRule(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-bold text-slate-700">Produtos e remuneração da Sorana</h3>
        <p className="mb-4 text-xs text-slate-500">Cadastre cada tipo de carta e a remuneração percentual da Sorana sobre o valor da carta.</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(160px,1fr)_160px_150px_auto]">
          <Input value={nome} onChange={event => setNome(event.target.value)} placeholder="Produto (ex.: Automóvel)" disabled={disabled} />
          <Input value={percentualSorana} onChange={event => setPercentualSorana(event.target.value)} placeholder="% remuneração Sorana" inputMode="decimal" disabled={disabled} />
          <select value={parcelasSorana} onChange={event => setParcelasSorana(Number(event.target.value))} disabled={disabled} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            {Array.from({ length: 10 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? 'parcela' : 'parcelas'}</option>)}
          </select>
          <Button onClick={addProduct} disabled={disabled} className="bg-cyan-700 text-white hover:bg-cyan-800">Adicionar</Button>
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-cyan-800 text-white"><tr>
              <th className="px-4 py-3 text-left text-xs">Produto</th>
              <th className="px-4 py-3 text-center text-xs">% Sorana sobre carta</th>
              <th className="px-4 py-3 text-center text-xs">Parcelas Sorana</th>
              <th className="px-4 py-3 text-center text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {produtos.length === 0 && <tr><td colSpan={4} className="py-7 text-center text-xs text-slate-400">Nenhum produto cadastrado.</td></tr>}
              {produtos.map((produto, index) => {
                const editing = editingProduct?.id === produto.id;
                return (
                  <tr key={produto.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-2">
                      {editing ? <Input value={editingProduct.nome} onChange={event => setEditingProduct({ ...editingProduct, nome: event.target.value })} disabled={disabled} className="h-8" /> : produto.nome}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {editing ? <Input value={editingProduct.percentualSorana} onChange={event => setEditingProduct({ ...editingProduct, percentualSorana: event.target.value })} inputMode="decimal" disabled={disabled} className="mx-auto h-8 max-w-36 text-center" /> : `${produto.percentualSorana}%`}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {editing ? <select value={editingProduct.parcelasSorana} onChange={event => setEditingProduct({ ...editingProduct, parcelasSorana: Number(event.target.value) })} disabled={disabled} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(count => <option key={count} value={count}>{count}</option>)}
                      </select> : produto.parcelasSorana}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {editing ? <div className="flex justify-center gap-2">
                        <button type="button" onClick={saveProductEdit} className="text-emerald-600">Salvar</button>
                        <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-500">Cancelar</button>
                      </div> : <div className="flex justify-center gap-3">
                        <button type="button" onClick={() => setEditingProduct({ ...produto })} disabled={disabled} className="text-cyan-700 hover:underline">Editar</button>
                        <button type="button" onClick={() => removeProduct(produto.id)} disabled={disabled} className="text-red-600 hover:underline">Excluir</button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-bold text-slate-700">Comissão do vendedor por cargo e produto</h3>
        <p className="mb-4 text-xs text-slate-500">
          Escolha se o percentual incide sobre o valor da carta, a comissão bruta ou a líquida da Sorana.
          Na base carta, o pagamento por parcela divide o total igualmente pelo número de parcelas da Sorana.
          A alíquota de imposto só é descontada da comissão da Sorana na base líquida.
          No cronograma, informe um percentual para cada parcela e use 0% quando não houver comissão.
          As bases bruta e líquida usam somente a parcela correspondente da Sorana; a base carta usa o valor integral da carta em cada parcela.
        </p>
        {(cargos.length === 0 || produtos.length === 0) && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Cadastre ao menos um cargo e um produto antes de configurar as comissões.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <select value={novoCargoId} onChange={event => setNovoCargoId(event.target.value)} disabled={disabled || cargos.length === 0} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Cargo...</option>{cargos.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>)}
          </select>
          <select value={novoProdutoId} onChange={event => {
            setNovoProdutoId(event.target.value);
            setNovosPercentuaisParcelas(Array(produtos.find(item => item.id === event.target.value)?.parcelasSorana ?? 0).fill('0'));
          }} disabled={disabled || produtos.length === 0} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Produto...</option>{produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
          </select>
          {novoPagamento === 'cronograma'
            ? <p className="self-center text-xs text-cyan-800">Percentuais por parcela abaixo</p>
            : <Input value={novoPercentual} onChange={event => setNovoPercentual(event.target.value)} placeholder="% comissão" inputMode="decimal" disabled={disabled} />}
          <select value={novaBase} onChange={event => setNovaBase(event.target.value as RegraComissaoConsorcio['base'])} disabled={disabled} className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2">
            {Object.entries(BASE_COMISSAO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={novoPagamento} onChange={event => setNovoPagamento(event.target.value as RegraComissaoConsorcio['pagamento'])} disabled={disabled} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="por_parcela">Por parcela recebida</option><option value="unica">Pagamento único</option>
            <option value="cronograma">Cronograma por parcela</option>
          </select>
        </div>
        {novoPagamento === 'cronograma' && (
          <div className="mt-4">
            {novoProdutoId
              ? <CronogramaEditor percentuais={novosPercentuaisParcelas} onChange={setNovosPercentuaisParcelas} disabled={disabled} />
              : <p className="text-xs text-slate-500">Selecione o produto para configurar as parcelas.</p>}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button onClick={addRule} disabled={disabled || cargos.length === 0 || produtos.length === 0} className="bg-cyan-700 text-white hover:bg-cyan-800">Adicionar regra</Button>
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-cyan-800 text-white"><tr>
              <th className="px-4 py-3 text-left text-xs">Cargo</th><th className="px-4 py-3 text-left text-xs">Produto</th>
              <th className="px-4 py-3 text-center text-xs">Comissão</th><th className="px-4 py-3 text-center text-xs">Base</th>
              <th className="px-4 py-3 text-center text-xs">Pagamento</th><th className="px-4 py-3 text-center text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {regras.length === 0 && <tr><td colSpan={6} className="py-7 text-center text-xs text-slate-400">Nenhuma regra cadastrada.</td></tr>}
              {regras.map((regra, index) => {
                const editing = editingRule?.id === regra.id;
                const cargoName = cargos.find(item => item.id === regra.cargoId)?.nome ?? 'Cargo removido';
                const productName = produtos.find(item => item.id === regra.produtoId)?.nome ?? 'Produto removido';
                return (
                  <tr key={regra.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-3 py-2">{editing ? <select value={editingRule.cargoId} onChange={event => setEditingRule({ ...editingRule, cargoId: event.target.value })} disabled={disabled} className="w-full rounded border px-2 py-1">{cargos.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select> : cargoName}</td>
                    <td className="px-3 py-2">{editing ? <select value={editingRule.produtoId} onChange={event => setEditingRule({
                      ...editingRule,
                      produtoId: event.target.value,
                      percentuaisParcelas: Array(produtos.find(item => item.id === event.target.value)?.parcelasSorana ?? 0).fill('0'),
                    })} disabled={disabled} className="w-full rounded border px-2 py-1">{produtos.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select> : productName}</td>
                    <td className="px-3 py-2 text-center">{editing
                      ? editingRule.pagamento === 'cronograma'
                        ? <CronogramaEditor percentuais={editingRule.percentuaisParcelas ?? []} onChange={percentuaisParcelas => setEditingRule({ ...editingRule, percentuaisParcelas })} disabled={disabled} />
                        : <Input value={editingRule.percentual} onChange={event => setEditingRule({ ...editingRule, percentual: event.target.value })} inputMode="decimal" disabled={disabled} className="h-8 text-center" />
                      : regra.pagamento === 'cronograma'
                        ? <div className="space-y-1 text-xs">{regra.percentuaisParcelas?.map((value, parcela) => <p key={parcela}>{parcela + 1}ª: {parsePercentualCadastro(value)}%</p>)}</div>
                        : `${regra.percentual}%`}</td>
                    <td className="px-3 py-2 text-center">{editing ? <select value={editingRule.base} onChange={event => setEditingRule({ ...editingRule, base: event.target.value as RegraComissaoConsorcio['base'] })} disabled={disabled} className="max-w-full rounded border px-2 py-1">{Object.entries(BASE_COMISSAO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : BASE_COMISSAO_LABELS[regra.base]}</td>
                    <td className="px-3 py-2 text-center">{editing ? <select value={editingRule.pagamento} onChange={event => setEditingRule({
                      ...editingRule,
                      pagamento: event.target.value as RegraComissaoConsorcio['pagamento'],
                      percentuaisParcelas: Array.from({ length: produtos.find(item => item.id === editingRule.produtoId)?.parcelasSorana ?? 0 }, (_, index) => editingRule.percentuaisParcelas?.[index] ?? '0'),
                    })} disabled={disabled} className="rounded border px-2 py-1"><option value="por_parcela">Por parcela</option><option value="unica">Único</option><option value="cronograma">Cronograma por parcela</option></select> : regra.pagamento === 'cronograma' ? 'Cronograma por parcela' : regra.pagamento === 'unica' ? 'Único' : 'Por parcela'}</td>
                    <td className="px-3 py-2 text-center">{editing ? <div className="flex justify-center gap-2"><button type="button" onClick={saveRuleEdit} className="text-emerald-600">Salvar</button><button type="button" onClick={() => setEditingRule(null)} className="text-slate-500">Cancelar</button></div> : <div className="flex justify-center gap-3"><button type="button" onClick={() => setEditingRule({ ...regra })} disabled={disabled} className="text-cyan-700 hover:underline">Editar</button><button type="button" onClick={() => onRegrasChange(regras.filter(item => item.id !== regra.id))} disabled={disabled} className="text-red-600 hover:underline">Excluir</button></div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CronogramaEditor({ percentuais, onChange, disabled }: {
  percentuais: string[];
  onChange: (items: string[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="min-w-40 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-left">
      <legend className="px-1 text-xs font-semibold text-cyan-900">Comissão por parcela</legend>
      <p className="mb-3 text-xs text-slate-600">Percentual sobre a base escolhida. Use 0% para não pagar.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {percentuais.map((value, index) => (
          <label key={index} className="text-xs text-slate-600">
            {index + 1}ª parcela (%)
            <Input value={value} inputMode="decimal" disabled={disabled} className="mt-1 h-8 bg-white"
              onChange={event => onChange(percentuais.map((item, parcela) => parcela === index ? event.target.value : item))} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EquipeSection({
  cargos,
  vendedores,
  regras,
  disabled,
  onCargosChange,
  onVendedoresChange,
}: {
  cargos: CargoConsorcio[];
  vendedores: VendedorConsorcio[];
  regras: RegraComissaoConsorcio[];
  disabled: boolean;
  onCargosChange: (items: CargoConsorcio[]) => void;
  onVendedoresChange: (items: VendedorConsorcio[]) => void;
}) {
  const [nomeCargo, setNomeCargo] = useState('');
  const [editingCargo, setEditingCargo] = useState<CargoConsorcio | null>(null);
  const [nomeVendedor, setNomeVendedor] = useState('');
  const [cargoVendedorId, setCargoVendedorId] = useState('');
  const [editingVendedor, setEditingVendedor] = useState<VendedorConsorcio | null>(null);

  function addCargo() {
    const nome = nomeCargo.trim();
    if (!nome) { toast.error('Informe o nome do cargo.'); return; }
    if (cargos.some(item => item.nome.toLocaleLowerCase() === nome.toLocaleLowerCase())) { toast.error('Este cargo já está cadastrado.'); return; }
    onCargosChange([...cargos, { id: crypto.randomUUID(), nome }]);
    setNomeCargo('');
  }

  function saveCargo() {
    if (!editingCargo) return;
    const nome = editingCargo.nome.trim();
    if (!nome) { toast.error('Informe o nome do cargo.'); return; }
    if (cargos.some(item => item.id !== editingCargo.id && item.nome.toLocaleLowerCase() === nome.toLocaleLowerCase())) { toast.error('Este cargo já está cadastrado.'); return; }
    onCargosChange(cargos.map(item => item.id === editingCargo.id ? { ...editingCargo, nome } : item));
    setEditingCargo(null);
  }

  function removeCargo(id: string) {
    if (vendedores.some(vendedor => vendedor.cargoId === id) || regras.some(regra => regra.cargoId === id)) {
      toast.error('Não é possível excluir um cargo usado por vendedor ou regra de comissão.');
      return;
    }
    onCargosChange(cargos.filter(item => item.id !== id));
  }

  function addVendedor() {
    const nome = nomeVendedor.trim();
    if (!nome || !cargoVendedorId) { toast.error('Informe o nome do vendedor e selecione o cargo.'); return; }
    if (vendedores.some(item => item.nome.trim().toLocaleLowerCase() === nome.toLocaleLowerCase())) { toast.error('Este vendedor já está cadastrado.'); return; }
    onVendedoresChange([...vendedores, { id: crypto.randomUUID(), nome, cargoId: cargoVendedorId }]);
    setNomeVendedor('');
  }

  function saveVendedor() {
    if (!editingVendedor) return;
    const nome = editingVendedor.nome.trim();
    if (!nome || !editingVendedor.cargoId) { toast.error('Informe o nome do vendedor e selecione o cargo.'); return; }
    if (vendedores.some(item => item.id !== editingVendedor.id && item.nome.trim().toLocaleLowerCase() === nome.toLocaleLowerCase())) { toast.error('Este vendedor já está cadastrado.'); return; }
    onVendedoresChange(vendedores.map(item => item.id === editingVendedor.id ? { ...editingVendedor, nome } : item));
    setEditingVendedor(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold text-slate-700">Cargos</h3>
        <div className="mb-4 flex gap-2">
          <Input value={nomeCargo} onChange={event => setNomeCargo(event.target.value)} placeholder="Nome do cargo..." disabled={disabled || !!editingCargo} />
          <Button onClick={addCargo} disabled={disabled || !!editingCargo} className="bg-cyan-700 text-white hover:bg-cyan-800">Adicionar cargo</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm"><thead className="bg-cyan-800 text-white"><tr><th className="px-4 py-3 text-left text-xs">Cargo</th><th className="px-4 py-3 text-center text-xs">Ações</th></tr></thead>
            <tbody>
              {cargos.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-xs text-slate-400">Nenhum cargo cadastrado.</td></tr>}
              {cargos.map((cargo, index) => <tr key={cargo.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-4 py-2">{editingCargo?.id === cargo.id ? <Input value={editingCargo.nome} onChange={event => setEditingCargo({ ...editingCargo, nome: event.target.value })} disabled={disabled} className="h-8" /> : cargo.nome}</td>
                <td className="px-4 py-2 text-center">{editingCargo?.id === cargo.id ? <div className="flex justify-center gap-3"><button type="button" onClick={saveCargo} className="text-emerald-600">Salvar</button><button type="button" onClick={() => setEditingCargo(null)} className="text-slate-500">Cancelar</button></div> : <div className="flex justify-center gap-3"><button type="button" onClick={() => setEditingCargo({ ...cargo })} disabled={disabled} className="text-cyan-700 hover:underline">Editar</button><button type="button" onClick={() => removeCargo(cargo.id)} disabled={disabled} className="text-red-600 hover:underline">Excluir</button></div>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-bold text-slate-700">Vendedores</h3>
        <p className="mb-4 text-xs text-slate-500">A comissão de cada vendedor seguirá a regra configurada para seu cargo e o produto vendido.</p>
        {cargos.length === 0 && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Cadastre um cargo antes de adicionar vendedores.</p>}
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
          <Input value={nomeVendedor} onChange={event => setNomeVendedor(event.target.value)} placeholder="Nome do vendedor..." disabled={disabled || cargos.length === 0} />
          <select value={cargoVendedorId} onChange={event => setCargoVendedorId(event.target.value)} disabled={disabled || cargos.length === 0} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Selecione o cargo...</option>{cargos.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>)}
          </select>
          <Button onClick={addVendedor} disabled={disabled || cargos.length === 0} className="bg-cyan-700 text-white hover:bg-cyan-800">Adicionar vendedor</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm"><thead className="bg-cyan-800 text-white"><tr><th className="px-4 py-3 text-left text-xs">Vendedor</th><th className="px-4 py-3 text-left text-xs">Cargo</th><th className="px-4 py-3 text-center text-xs">Ações</th></tr></thead>
            <tbody>
              {vendedores.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-xs text-slate-400">Nenhum vendedor cadastrado.</td></tr>}
              {vendedores.map((vendedor, index) => <tr key={vendedor.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-4 py-2">{editingVendedor?.id === vendedor.id ? <Input value={editingVendedor.nome} onChange={event => setEditingVendedor({ ...editingVendedor, nome: event.target.value })} disabled={disabled} className="h-8" /> : vendedor.nome}</td>
                <td className="px-4 py-2">{editingVendedor?.id === vendedor.id ? <select value={editingVendedor.cargoId} onChange={event => setEditingVendedor({ ...editingVendedor, cargoId: event.target.value })} disabled={disabled} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">{cargos.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>)}</select> : cargos.find(cargo => cargo.id === vendedor.cargoId)?.nome ?? 'Cargo removido'}</td>
                <td className="px-4 py-2 text-center">{editingVendedor?.id === vendedor.id ? <div className="flex justify-center gap-3"><button type="button" onClick={saveVendedor} className="text-emerald-600">Salvar</button><button type="button" onClick={() => setEditingVendedor(null)} className="text-slate-500">Cancelar</button></div> : <div className="flex justify-center gap-3"><button type="button" onClick={() => setEditingVendedor({ ...vendedor })} disabled={disabled} className="text-cyan-700 hover:underline">Editar</button><button type="button" onClick={() => onVendedoresChange(vendedores.filter(item => item.id !== vendedor.id))} disabled={disabled} className="text-red-600 hover:underline">Excluir</button></div>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ImpostosSection({
  aliquota,
  hasBaseLiquida,
  disabled,
  onChange,
}: {
  aliquota: string;
  hasBaseLiquida: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-slate-700">Alíquota de imposto</h3>
      <p className="mb-5 mt-1 text-xs text-slate-500">Esta alíquota é descontada da remuneração bruta da Sorana quando uma regra usa a base líquida.</p>
      <label htmlFor="consorcio-aliquota" className="mb-1 block text-xs font-medium text-slate-600">Alíquota (%)</label>
      <div className="flex max-w-xs items-center gap-2">
        <Input id="consorcio-aliquota" value={aliquota} onChange={event => onChange(event.target.value)} placeholder="Ex.: 5,00" inputMode="decimal" disabled={disabled} />
        <span className="text-sm text-slate-500">%</span>
      </div>
      {hasBaseLiquida && !isValidPercent(aliquota) && <p className="mt-3 text-xs text-amber-700">Informe uma alíquota entre 0 e 100% para salvar regras com base líquida.</p>}
    </section>
  );
}
