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
    titulo: '',
    descricao: '',
    valor: '',
    solicitante: 'Sancho Hara',
    departamento: '',
    marca: '',
    categoria: '',
    status: 'pendente' as Despesa['status'],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.valor || !formData.departamento || 
        !formData.marca || !formData.categoria) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);

    try {
      const novaDespesa = addDespesa({
        ...formData,
        valor: parseFloat(formData.valor),
        data: new Date().toISOString().split('T')[0],
      });

      toast.success('Despesa criada com sucesso!', {
        description: `${novaDespesa.titulo} - R$ ${novaDespesa.valor.toLocaleString('pt-BR')}`,
      });

      // Limpar formulário
      setFormData({
        titulo: '',
        descricao: '',
        valor: '',
        solicitante: 'Sancho Hara',
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
      titulo: '',
      descricao: '',
      valor: '',
      solicitante: 'Sancho Hara',
      departamento: '',
      marca: '',
      categoria: '',
      status: 'pendente',
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-8 h-8" />
            Nova Despesa
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Preencha o formulário para criar uma nova solicitação de despesa
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações da Despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
    </div>
  );
}
