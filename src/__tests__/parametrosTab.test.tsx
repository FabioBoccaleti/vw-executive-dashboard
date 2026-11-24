import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParametrosTab } from '@/components/FluxoCaixaDashboard/ParametrosTab';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/components/FluxoCaixaDashboard/parametrosPdfStorage', () => ({
  loadParametrosPdf: mocks.load,
  saveParametrosPdf: mocks.save,
  MAX_PARAMETROS_PDF_BYTES: 700 * 1024,
}));

beforeEach(() => {
  mocks.load.mockResolvedValue(null);
  mocks.save.mockReset();
});

describe('aba Parâmetros da Análise Financeira', () => {
  it('permite que todos visualizem o PDF e reserva a substituição para administradores', async () => {
    const { rerender } = render(<ParametrosTab isAdmin={false} />);
    expect(await screen.findByTitle('Visualizador do PDF de parâmetros para geração de relatórios')).toHaveAttribute(
      'src',
      '/parametros-de-relatorios.pdf',
    );
    expect(screen.queryByRole('button', { name: 'Importar / substituir PDF' })).not.toBeInTheDocument();

    rerender(<ParametrosTab isAdmin />);
    expect(await screen.findByRole('button', { name: 'Importar / substituir PDF' })).toBeInTheDocument();
  });
});
