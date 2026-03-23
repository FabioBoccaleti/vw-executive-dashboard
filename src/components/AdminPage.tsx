import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Users, Shield, ClipboardList, Plus, Pencil, Trash2, X,
  ChevronLeft, Eye, EyeOff, Check, AlertCircle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicUser, AccessLogEntry, ModuleId, BrandId, UserRole, VendasSubModuleId } from '@/lib/authTypes';
import { ALL_MODULES, ALL_BRANDS, MODULE_LABELS, BRAND_LABELS, VENDAS_SUB_MODULE_LABELS } from '@/lib/authTypes';
import {
  apiListUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiGetLogs,
} from '@/lib/authClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  leitura: 'Leitura',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  gestor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  leitura: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Formulário de usuário ────────────────────────────────────────────────────

interface UserFormData {
  name: string;
  username: string;
  password: string;
  role: UserRole;
  modules: ModuleId[];
  brands: BrandId[];
  vendasSubModules: VendasSubModuleId[];
  active: boolean;
}

const defaultForm = (): UserFormData => ({
  name: '', username: '', password: '', role: 'leitura',
  modules: [], brands: [], vendasSubModules: [], active: true,
});

interface UserFormProps {
  initial?: Partial<UserFormData> & { id?: string };
  onSave: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

function UserForm({ initial, onSave, onCancel, isEdit }: UserFormProps) {
  const [form, setForm] = useState<UserFormData>({ ...defaultForm(), ...initial });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleModule = (m: ModuleId) =>
    setForm(f => ({
      ...f,
      modules: f.modules.includes(m) ? f.modules.filter(x => x !== m) : [...f.modules, m],
    }));

  const toggleBrand = (b: BrandId) =>
    setForm(f => ({
      ...f,
      brands: f.brands.includes(b) ? f.brands.filter(x => x !== b) : [...f.brands, b],
    }));

  const toggleVendasSub = (s: VendasSubModuleId) =>
    setForm(f => ({
      ...f,
      vendasSubModules: f.vendasSubModules.includes(s)
        ? f.vendasSubModules.filter(x => x !== s)
        : [...f.vendasSubModules, s],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim()) {
      setError('Nome e usuário são obrigatórios');
      return;
    }
    if (!isEdit && !form.password) {
      setError('Senha é obrigatória');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar');
      setSaving(false);
    }
  };

  const isAdmin = form.role === 'admin';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome completo *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João Silva" />
        </div>
        <div className="space-y-1.5">
          <Label>Usuário (login) *</Label>
          <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Ex: joao.silva" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</Label>
          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? 'Nova senha...' : 'Digite a senha'}
              className="pr-10"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Perfil *</Label>
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
            className="w-full appearance-none bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="admin">Administrador</option>
            <option value="gestor">Gestor</option>
            <option value="leitura">Leitura</option>
          </select>
        </div>
      </div>

      {/* Módulos — visível apenas para gestor/leitura */}
      {!isAdmin && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Módulos permitidos</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ALL_MODULES.map(m => (
              <button
                key={m} type="button"
                onClick={() => toggleModule(m)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
                  form.modules.includes(m)
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-background text-muted-foreground hover:border-input',
                )}
              >
                {form.modules.includes(m) && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>{MODULE_LABELS[m]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empresas — somente para demonstrativo */}
      {!isAdmin && form.modules.includes('demonstrativo') && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Empresas permitidas (Demonstrativo de Resultados)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ALL_BRANDS.map(b => (
              <button
                key={b} type="button"
                onClick={() => toggleBrand(b)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-colors',
                  form.brands.includes(b)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'border-border bg-background text-muted-foreground hover:border-input',
                )}
              >
                {form.brands.includes(b) && <Check className="w-3 h-3 shrink-0" />}
                {BRAND_LABELS[b]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subpermissões Vendas e Bonificações */}
      {!isAdmin && form.modules.includes('vendas_bonificacoes') && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800 p-4">
          <Label className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Permissões — Demonstrativo de Vendas e Bonificações
          </Label>

          {/* Blindagem */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Análise e Controle das Vendas de Blindagem</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['blindagem.tabela', 'blindagem.analise', 'blindagem.todas', 'blindagem.revenda_vw', 'blindagem.revenda_audi'] as VendasSubModuleId[]).map(s => (
                <button
                  key={s} type="button"
                  onClick={() => toggleVendasSub(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors',
                    form.vendasSubModules.includes(s)
                      ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium'
                      : 'border-border bg-background text-muted-foreground hover:border-input',
                  )}
                >
                  {form.vendasSubModules.includes(s) && <Check className="w-3 h-3 shrink-0" />}
                  {VENDAS_SUB_MODULE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Películas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Análise e Controle de Vendas de Películas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['peliculas.tabela', 'peliculas.analise'] as VendasSubModuleId[]).map(s => (
                <button
                  key={s} type="button"
                  onClick={() => toggleVendasSub(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors',
                    form.vendasSubModules.includes(s)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'border-border bg-background text-muted-foreground hover:border-input',
                  )}
                >
                  {form.vendasSubModules.includes(s) && <Check className="w-3 h-3 shrink-0" />}
                  {VENDAS_SUB_MODULE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="active"
          checked={form.active}
          onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
          className="w-4 h-4 accent-emerald-600"
        />
        <Label htmlFor="active" className="cursor-pointer">Usuário ativo</Label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = 'users' | 'logs';

interface AdminPageProps {
  onBack: () => void;
}

export function AdminPage({ onBack }: AdminPageProps) {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  const showFeedback = (text: string, type: 'ok' | 'err') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const list = await apiListUsers();
      setUsers(list);
    } catch {
      showFeedback('Erro ao carregar usuários', 'err');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const list = await apiGetLogs();
      setLogs(list);
    } catch {
      showFeedback('Erro ao carregar logs', 'err');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, loadLogs]);

  const handleCreate = async (data: any) => {
    await apiCreateUser(data);
    showFeedback('Usuário criado com sucesso!', 'ok');
    setFormMode('none');
    loadUsers();
  };

  const handleEdit = async (data: any) => {
    if (!editingUser) return;
    const payload = { ...data };
    if (!payload.password) delete payload.password;
    await apiUpdateUser(editingUser.id, payload);
    showFeedback('Usuário atualizado com sucesso!', 'ok');
    setFormMode('none');
    setEditingUser(null);
    loadUsers();
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteUser(id);
      showFeedback('Usuário excluído', 'ok');
      setDeleteConfirm(null);
      loadUsers();
    } catch (err: any) {
      showFeedback(err.message ?? 'Erro ao excluir', 'err');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-600" />
                Administração de Usuários
              </h1>
              <p className="text-xs text-muted-foreground">Gerencie acessos e permissões do sistema</p>
            </div>
          </div>

          {/* Feedback toast */}
          {feedbackMsg && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-all',
              feedbackMsg.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 text-red-700 dark:text-red-300',
            )}>
              {feedbackMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedbackMsg.text}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
          {([['users', Users, 'Usuários'], ['logs', ClipboardList, 'Log de Acesso']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-white dark:bg-slate-800 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Aba Usuários ─────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {formMode !== 'none' ? (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center justify-between">
                    {formMode === 'create' ? 'Novo Usuário' : `Editar: ${editingUser?.name}`}
                    <button onClick={() => { setFormMode('none'); setEditingUser(null); }}
                      className="text-muted-foreground hover:text-foreground p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UserForm
                    initial={editingUser ? {
                      name: editingUser.name,
                      username: editingUser.username,
                      role: editingUser.role,
                      modules: editingUser.modules,
                      brands: editingUser.brands,
                      vendasSubModules: (editingUser as any).vendasSubModules ?? [],
                      active: editingUser.active,
                    } : undefined}
                    onSave={formMode === 'create' ? handleCreate : handleEdit}
                    onCancel={() => { setFormMode('none'); setEditingUser(null); }}
                    isEdit={formMode === 'edit'}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadUsers} disabled={loadingUsers}>
                    <RefreshCw className={cn('w-4 h-4', loadingUsers && 'animate-spin')} />
                  </Button>
                  <Button size="sm" onClick={() => setFormMode('create')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                    <Plus className="w-4 h-4" />
                    Novo usuário
                  </Button>
                </div>
              </div>
            )}

            {loadingUsers ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
            ) : users.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum usuário cadastrado ainda.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <Card key={u.id} className={cn(!u.active && 'opacity-60')}>
                    <CardContent className="py-3 px-4">
                      <div className="flex flex-wrap items-start gap-3 justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base font-bold text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">{u.name}</span>
                              <span className="text-xs text-muted-foreground">@{u.username}</span>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role])}>
                                {ROLE_LABELS[u.role]}
                              </span>
                              {!u.active && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Inativo</span>}
                            </div>
                            {u.role !== 'admin' && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {u.modules.map(m => (
                                  <span key={m} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                                    {MODULE_LABELS[m]}
                                  </span>
                                ))}
                                {u.modules.includes('demonstrativo') && u.brands.map(b => (
                                  <span key={b} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                                    {BRAND_LABELS[b]}
                                  </span>
                                ))}
                                {u.modules.length === 0 && (
                                  <span className="text-[10px] text-muted-foreground/60">Sem módulos permitidos</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingUser(u); setFormMode('edit'); }}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {deleteConfirm === u.id ? (
                            <div className="flex items-center gap-1 ml-1">
                              <span className="text-xs text-red-500 mr-1">Confirmar?</span>
                              <button onClick={() => handleDelete(u.id)}
                                className="px-2 py-1 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 transition-colors">
                                Sim
                              </button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(u.id)}
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Aba Log de Acesso ─────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{logs.length} registro(s)</p>
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={loadingLogs}>
                <RefreshCw className={cn('w-4 h-4', loadingLogs && 'animate-spin')} />
              </Button>
            </div>

            {loadingLogs ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
            ) : logs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum registro de acesso ainda.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="py-2.5 px-4 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">Data/Hora</th>
                          <th className="py-2.5 px-4 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">Usuário</th>
                          <th className="py-2.5 px-4 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">Ação</th>
                          <th className="py-2.5 px-4 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">Módulo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log, i) => (
                          <tr key={log.id} className={cn('border-b border-border/50', i % 2 === 0 ? '' : 'bg-muted/20')}>
                            <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtDate(log.timestamp)}</td>
                            <td className="py-2.5 px-4 text-sm font-medium text-foreground">{log.username}</td>
                            <td className="py-2.5 px-4 text-sm">
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                log.action === 'login' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                log.action === 'logout' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
                              )}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-sm text-muted-foreground">{log.module ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
