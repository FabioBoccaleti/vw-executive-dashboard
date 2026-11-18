import { describe, expect, it } from 'vitest';
import { parsePercentualCadastro } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/cadastroStorage';

describe('parsePercentualCadastro', () => {
  it('converts Brazilian decimal percentages with an optional percent sign', () => {
    expect(parsePercentualCadastro('14,25%')).toBe(14.25);
    expect(parsePercentualCadastro('14,25')).toBe(14.25);
  });

  it('accepts dot decimals and rejects empty or invalid values', () => {
    expect(parsePercentualCadastro('14.25%')).toBe(14.25);
    expect(parsePercentualCadastro('')).toBeNull();
    expect(parsePercentualCadastro('inválido%')).toBeNull();
  });
});
