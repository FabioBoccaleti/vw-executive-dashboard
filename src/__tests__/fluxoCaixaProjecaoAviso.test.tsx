import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FluxoCaixaDashboard } from '@/components/FluxoCaixaDashboard';

vi.mock('@/components/FluxoCaixaDashboard/fluxoCaixaStorage', () => ({
  loadFluxoCaixaRaw: vi.fn().mockResolvedValue(null),
  loadFluxoCaixaIndex: vi.fn().mockResolvedValue({}),
  saveFluxoCaixaData: vi.fn(),
}));
vi.mock('@/lib/kvClient', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn(),
}));
vi.mock('@/components/FluxoCaixaDashboard/ComparativosTab', () => ({
  ComparativosTab: () => <div>Comparativos</div>,
}));

afterEach(cleanup);

it('mostra o aviso ao entrar em Projeção, fecha com OK e reaparece somente em uma nova entrada', async () => {
  render(<FluxoCaixaDashboard />);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Projeção' }));
  const aviso = within(await screen.findByRole('alertdialog'));
  expect(aviso.getByText('Funcionalidade ainda em Teste.')).toBeInTheDocument();
  fireEvent.click(aviso.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(screen.getByText('Nenhum dado realizado disponível')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Projeção' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Comparativos' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Projeção' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Funcionalidade ainda em Teste.');
});
