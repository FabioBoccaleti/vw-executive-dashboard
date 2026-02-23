/**
 * Formulário de Nova Despesa
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Save, X } from 'lucide-react';
import { addDespesa } from '@/lib/despesasStorage';
import { toast } from 'sonner';
import type { Despesa } from '@/data/despesasData';

interface NovaDespesaProps {
  onSuccess?: () => void;
}

export function NovaDespesa({ onSuccess }: NovaDespesaProps) {
  const [formData, setFormData] = useState({
    identificacaoEmitente: '',
    numeroNotaFiscal: '',
    imagemNotaFiscal: '',
    titulo: '',
    descricao: '',
    valor: '',
    solicitante: 'Fabio Boccaleti',
    gerenteAprovador: '',
    diretorAprovador: '',
    departamento: '',
    marca: '',
    categoria: '',
    status: 'pendente' as Despesa['status'],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.identificacaoEmitente || !formData.numeroNotaFiscal || !formData.titulo || !formData.valor || !formData.departamento || 
        !formData.marca || !formData.categoria || !formData.gerenteAprovador || !formData.diretorAprovador) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);

    try {
      const novaDespesa = await addDespesa({
        ...formData,
        valor: parseFloat(formData.valor),
        data: new Date().toISOString().split('T')[0],
      });

      toast.success('Despesa criada e sincronizada!', {
        description: `${novaDespesa.titulo} - R$ ${novaDespesa.valor.toLocaleString('pt-BR')} - Outros usuários podem visualizar agora`,
      });

      // Limpar formulário
      setFormData({
        identificacaoEmitente: '',
        numeroNotaFiscal: '',
        imagemNotaFiscal: '',
        titulo: '',
        descricao: '',
        valor: '',
        solicitante: 'Fabio Boccaleti',
        gerenteAprovador: '',
        diretorAprovador: '',
        departamento: '',
        marca: '',
        categoria: '',
        status: 'pendente',
      });

      onSuccess?.();
    } catch (error) {
      toast.error('Erro ao criar despesa');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      identificacaoEmitente: '',
      numeroNotaFiscal: '',
      imagemNotaFiscal: '',
      titulo: '',
      descricao: '',
      valor: '',
      solicitante: 'Fabio Boccaleti',
      gerenteAprovador: '',
      diretorAprovador: '',
      departamento: '',
      marca: '',
      categoria: '',
      status: 'pendente',
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-8 h-8" />
            Nova Despesa
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Preencha o formulário para criar uma nova solicitação de despesa
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Despesa</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
              {/* Imagem/PDF da Nota Fiscal */}
              <div className="space-y-2">
                <Label htmlFor="imagemNotaFiscal">
                  Nota Fiscal (Foto, Imagem ou PDF)
                </Label>
                <Input
                  id="imagemNotaFiscal"
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Limite de 5MB
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Arquivo muito grande. Tamanho máximo: 5MB');
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, imagemNotaFiscal: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="cursor-pointer"
                />
                {formData.imagemNotaFiscal && (
                  <p className="text-sm text-emerald-600">✓ Arquivo anexado</p>
                )}
                <p className="text-xs text-slate-500">
                  Aceita: JPG, PNG, PDF, HEIC e outros formatos de imagem (máx. 5MB)
                </p>
              </div>

              {/* Identificação do Emitente e Nº Nota Fiscal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="identificacaoEmitente">
                    Identificação do Emitente <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="identificacaoEmitente"
                    placeholder="Ex: Razão Social ou Nome do Fornecedor"
                    value={formData.identificacaoEmitente}
                    onChange={(e) => setFormData({ ...formData, identificacaoEmitente: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numeroNotaFiscal">
                    Nº Nota Fiscal <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="numeroNotaFiscal"
                    placeholder="Ex: 12345678"
                    value={formData.numeroNotaFiscal}
                    onChange={(e) => setFormData({ ...formData, numeroNotaFiscal: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">
                  Título da Despesa <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="titulo"
                  placeholder="Ex: Campanha Digital Tiguan"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva os detalhes da despesa..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Valor e Solicitante */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">
                    Valor (R$) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solicitante">Solicitante</Label>
                  <Input
                    id="solicitante"
                    value={formData.solicitante}
                    onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })}
                    disabled
                  />
                </div>
              </div>

              {/* Gerente Aprovador e Diretor Aprovador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gerenteAprovador">
                    Gerente(a) Aprovador <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.gerenteAprovador}
                    onValueChange={(value) => setFormData({ ...formData, gerenteAprovador: value })}
                    required
                  >
                    <SelectTrigger id="gerenteAprovador">
                      <SelectValue placeholder="Selecione o gerente aprovador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alexandre D Auria">Alexandre D Auria</SelectItem>
                      <SelectItem value="Andre Simoni">Andre Simoni</SelectItem>
                      <SelectItem value="Daniel Fanti">Daniel Fanti</SelectItem>
                      <SelectItem value="Fabio Boccaleti">Fabio Boccaleti</SelectItem>
                      <SelectItem value="Gabriela S Mateus">Gabriela S Mateus</SelectItem>
                      <SelectItem value="Geraldo Palma">Geraldo Palma</SelectItem>
                      <SelectItem value="Norival Junior">Norival Junior</SelectItem>
                      <SelectItem value="Orlando Chodin">Orlando Chodin</SelectItem>
                      <SelectItem value="Roberto Vazquez">Roberto Vazquez</SelectItem>
                      <SelectItem value="Sergio Ribeiro">Sergio Ribeiro</SelectItem>
                      <SelectItem value="Thiago Correira">Thiago Correira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diretorAprovador">
                    Diretor(a) Aprovador <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.diretorAprovador}
                    onValueChange={(value) => setFormData({ ...formData, diretorAprovador: value })}
                    required
                  >
                    <SelectTrigger id="diretorAprovador">
                      <SelectValue placeholder="Selecione o diretor aprovador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gabriela S Mateus">Gabriela S Mateus</SelectItem>
                      <SelectItem value="Orlando Chodin">Orlando Chodin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Departamento e Marca */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departamento">
                    Departamento <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.departamento}
                    onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                    required
                  >
                    <SelectTrigger id="departamento">
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Veículos Novos">Veículos Novos</SelectItem>
                      <SelectItem value="Veículos Usados">Veículos Usados</SelectItem>
                      <SelectItem value="Venda Direta / Frotista">Venda Direta / Frotista</SelectItem>
                      <SelectItem value="Peças">Peças</SelectItem>
                      <SelectItem value="Oficina">Oficina</SelectItem>
                      <SelectItem value="Funilaria">Funilaria</SelectItem>
                      <SelectItem value="Acessórios">Acessórios</SelectItem>
                      <SelectItem value="Administração">Administração</SelectItem>
                      <SelectItem value="Diretoria">Diretoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marca">
                    Marca <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.marca}
                    onValueChange={(value) => setFormData({ ...formData, marca: value })}
                    required
                  >
                    <SelectTrigger id="marca">
                      <SelectValue placeholder="Selecione a marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Volkswagen">Volkswagen</SelectItem>
                      <SelectItem value="Audi">Audi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Categoria */}
              <div className="space-y-2">
                <Label htmlFor="categoria">
                  Categoria <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  required
                >
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Combustível">Combustível</SelectItem>
                    <SelectItem value="Manutenção/Oficina">Manutenção/Oficina</SelectItem>
                    <SelectItem value="RH">Recursos Humanos</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="TI">Tecnologia</SelectItem>
                    <SelectItem value="Viagens">Viagens</SelectItem>
                    <SelectItem value="Treinamento">Treinamento</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isSubmitting}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Salvando...' : 'Criar Despesa'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
          </div>

          {/* Pré-visualização da Imagem/PDF */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 flex flex-col h-[900px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>Nota Fiscal</span>
                  {formData.imagemNotaFiscal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, imagemNotaFiscal: '' })}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remover
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pt-0 pb-6">
                {formData.imagemNotaFiscal ? (
                  <div className="relative rounded-lg overflow-hidden border-2 border-emerald-200 bg-slate-50 h-full">
                    {formData.imagemNotaFiscal.startsWith('data:application/pdf') ? (
                      <iframe
                        src={formData.imagemNotaFiscal}
                        className="w-full h-full border-0"
                        title="Pré-visualização PDF da Nota Fiscal"
                      />
                    ) : (
                      <img
                        src={formData.imagemNotaFiscal}
                        alt="Pré-visualização da Nota Fiscal"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                    <p className="text-slate-400 text-center px-4">
                      Nenhum arquivo anexado<br />
                      <span className="text-sm">Faça upload de imagem ou PDF</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
