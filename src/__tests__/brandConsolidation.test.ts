/**
 * Teste específico para verificar a consolidação de dados VW + Audi
 * 
 * Este teste verifica se quando a marca "consolidado" é selecionada,
 * os dados mostrados são a soma de VW + Audi corretamente.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadMetricsData,
  saveMetricsData,
  clearDbCache,
  initializeFromDatabase,
  type MetricsData,
} from '@/lib/dataStorage'
import { consolidateMetricsData } from '@/lib/dataConsolidation'

describe('Consolidação de Marcas VW + Audi', () => {
  beforeEach(() => {
    localStorage.clear()
    clearDbCache()
  })

  describe('Diagnóstico - Verificação de Dados de Cada Marca', () => {
    it('deve verificar se dados de VW são carregados corretamente', () => {
      const vwData = loadMetricsData(2025, 'novos', 'vw')
      
      console.log('=== DADOS VW (novos, 2025) ===')
      console.log('vendasNovos.vendas:', vwData.vendasNovos.vendas)
      console.log('vendasNovos.volumeTrocas:', vwData.vendasNovos.volumeTrocas)
      
      expect(vwData).toBeDefined()
      expect(vwData.months).toHaveLength(12)
      
      // VW deve ter dados (não zerados)
      const totalVendasVW = vwData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      console.log('Total vendas VW:', totalVendasVW)
    })

    it('deve verificar se dados de Audi são carregados corretamente', () => {
      const audiData = loadMetricsData(2025, 'novos', 'audi')
      
      console.log('=== DADOS AUDI (novos, 2025) ===')
      console.log('vendasNovos.vendas:', audiData.vendasNovos.vendas)
      console.log('vendasNovos.volumeTrocas:', audiData.vendasNovos.volumeTrocas)
      
      expect(audiData).toBeDefined()
      expect(audiData.months).toHaveLength(12)
      
      // Verificar total de vendas Audi
      const totalVendasAudi = audiData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      console.log('Total vendas Audi:', totalVendasAudi)
    })

    it('deve verificar se dados Consolidados são VW + Audi', () => {
      const vwData = loadMetricsData(2025, 'novos', 'vw')
      const audiData = loadMetricsData(2025, 'novos', 'audi')
      const consolidadoData = loadMetricsData(2025, 'novos', 'consolidado')
      
      console.log('=== COMPARAÇÃO DE CONSOLIDAÇÃO ===')
      
      const totalVendasVW = vwData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      const totalVendasAudi = audiData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      const totalVendasConsolidado = consolidadoData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      
      console.log('Total vendas VW:', totalVendasVW)
      console.log('Total vendas Audi:', totalVendasAudi)
      console.log('Total vendas Consolidado:', totalVendasConsolidado)
      console.log('Esperado (VW + Audi):', totalVendasVW + totalVendasAudi)
      
      // O consolidado deve ser igual a VW + Audi
      expect(totalVendasConsolidado).toBe(totalVendasVW + totalVendasAudi)
      
      // Verificação detalhada mês a mês
      for (let i = 0; i < 12; i++) {
        const vwMes = vwData.vendasNovos.vendas[i]
        const audiMes = audiData.vendasNovos.vendas[i]
        const consolidadoMes = consolidadoData.vendasNovos.vendas[i]
        const esperado = vwMes + audiMes
        
        if (consolidadoMes !== esperado) {
          console.log(`Mês ${i}: VW=${vwMes}, Audi=${audiMes}, Consolidado=${consolidadoMes}, Esperado=${esperado}`)
        }
        
        expect(consolidadoMes).toBe(esperado)
      }
    })
  })

  describe('Consolidação com Dados Salvos', () => {
    it('deve consolidar corretamente quando há dados salvos para ambas as marcas', () => {
      // Cria dados mockados para VW
      const mockVWData: MetricsData = {
        months: ['Jan/25', 'Fev/25', 'Mar/25', 'Abr/25', 'Mai/25', 'Jun/25', 'Jul/25', 'Ago/25', 'Set/25', 'Out/25', 'Nov/25', 'Dez/25'],
        vendasNovos: { vendas: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], volumeTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasNovosVD: { vendas: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], volumeTrocas: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasUsados: { vendas: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80], volumeTrocas: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        volumeVendas: { usados: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60], repasse: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6], percentualRepasse: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        estoqueNovos: { quantidade: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40], valor: [4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000], aPagar: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000], pagos: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000] },
        estoqueUsados: { quantidade: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], valor: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000], aPagar: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500], pagos: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500] },
        estoquePecas: { quantidade: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500], valor: [50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000], aPagar: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000], pagos: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000] },
      }

      // Cria dados mockados para Audi (diferentes de VW)
      const mockAudiData: MetricsData = {
        months: ['Jan/25', 'Fev/25', 'Mar/25', 'Abr/25', 'Mai/25', 'Jun/25', 'Jul/25', 'Ago/25', 'Set/25', 'Out/25', 'Nov/25', 'Dez/25'],
        vendasNovos: { vendas: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], volumeTrocas: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasNovosVD: { vendas: [25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25], volumeTrocas: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasUsados: { vendas: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40], volumeTrocas: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        volumeVendas: { usados: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], repasse: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], percentualRepasse: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        estoqueNovos: { quantidade: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], valor: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000], aPagar: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], pagos: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000] },
        estoqueUsados: { quantidade: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15], valor: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500], aPagar: [750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750], pagos: [750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750] },
        estoquePecas: { quantidade: [250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250], valor: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000], aPagar: [12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500], pagos: [12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500] },
      }

      // Salva dados VW
      saveMetricsData(2025, mockVWData, 'novos', 'vw')
      
      // Salva dados Audi
      saveMetricsData(2025, mockAudiData, 'novos', 'audi')
      
      // Carrega dados consolidados
      const consolidadoData = loadMetricsData(2025, 'novos', 'consolidado')
      
      console.log('=== CONSOLIDAÇÃO COM DADOS SALVOS ===')
      console.log('VW vendas:', mockVWData.vendasNovos.vendas[0])
      console.log('Audi vendas:', mockAudiData.vendasNovos.vendas[0])
      console.log('Consolidado vendas:', consolidadoData.vendasNovos.vendas[0])
      
      // Verifica se a consolidação está correta (100 + 50 = 150)
      expect(consolidadoData.vendasNovos.vendas[0]).toBe(150)
      
      // Total VW = 1200, Total Audi = 600, Consolidado deve ser 1800
      const totalConsolidado = consolidadoData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      expect(totalConsolidado).toBe(1800)
    })
  })

  describe('Função consolidateMetricsData', () => {
    it('deve somar corretamente os arrays de vendas', () => {
      const vwData: MetricsData = {
        months: ['Jan/25', 'Fev/25', 'Mar/25', 'Abr/25', 'Mai/25', 'Jun/25', 'Jul/25', 'Ago/25', 'Set/25', 'Out/25', 'Nov/25', 'Dez/25'],
        vendasNovos: { vendas: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200], volumeTrocas: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasNovosVD: { vendas: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], volumeTrocas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasUsados: { vendas: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160], volumeTrocas: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        volumeVendas: { usados: [40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150], repasse: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], percentualRepasse: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        estoqueNovos: { quantidade: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], valor: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000], aPagar: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500], pagos: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500] },
        estoqueUsados: { quantidade: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], valor: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000], aPagar: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], pagos: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000] },
        estoquePecas: { quantidade: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], valor: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000], aPagar: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000], pagos: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000] },
      }

      const audiData: MetricsData = {
        months: ['Jan/25', 'Fev/25', 'Mar/25', 'Abr/25', 'Mai/25', 'Jun/25', 'Jul/25', 'Ago/25', 'Set/25', 'Out/25', 'Nov/25', 'Dez/25'],
        vendasNovos: { vendas: [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600], volumeTrocas: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasNovosVD: { vendas: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], volumeTrocas: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        vendasUsados: { vendas: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80], volumeTrocas: [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8], percentualTrocas: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        volumeVendas: { usados: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75], repasse: [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7], percentualRepasse: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
        estoqueNovos: { quantidade: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15], valor: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500], aPagar: [750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750], pagos: [750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750, 750] },
        estoqueUsados: { quantidade: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], valor: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], aPagar: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500], pagos: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500] },
        estoquePecas: { quantidade: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], valor: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000], aPagar: [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500], pagos: [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500] },
      }

      const consolidado = consolidateMetricsData(vwData, audiData)
      
      // Janeiro: VW = 100, Audi = 50 => Consolidado = 150
      expect(consolidado.vendasNovos.vendas[0]).toBe(150)
      
      // Fevereiro: VW = 200, Audi = 100 => Consolidado = 300
      expect(consolidado.vendasNovos.vendas[1]).toBe(300)
      
      // Total Vendas Novos: VW = 7800, Audi = 3900 => Consolidado = 11700
      const totalVendasNovos = consolidado.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      expect(totalVendasNovos).toBe(11700)
      
      console.log('=== CONSOLIDAÇÃO DIRETA ===')
      console.log('Janeiro - VW:', vwData.vendasNovos.vendas[0], 'Audi:', audiData.vendasNovos.vendas[0], 'Consolidado:', consolidado.vendasNovos.vendas[0])
      console.log('Total Vendas Novos:', totalVendasNovos)
    })
  })

  describe('Verificação de Dados Padrão para Audi', () => {
    it('deve retornar dados zerados para Audi quando não há dados salvos', () => {
      const audiData = loadMetricsData(2025, 'novos', 'audi')
      
      console.log('=== DADOS PADRÃO AUDI ===')
      console.log('vendasNovos.vendas:', audiData.vendasNovos.vendas)
      
      // Verifica se todos os valores são zero (dados zerados para Audi sem dados salvos)
      const totalVendas = audiData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      console.log('Total vendas Audi (padrão):', totalVendas)
      
      // Se retorna zerado, o problema está aqui!
      // Audi sem dados salvos retorna dados zerados
    })

    it('deve verificar se consolidado = VW quando Audi está zerada', () => {
      const vwData = loadMetricsData(2025, 'novos', 'vw')
      const audiData = loadMetricsData(2025, 'novos', 'audi')
      const consolidadoData = loadMetricsData(2025, 'novos', 'consolidado')
      
      const totalVW = vwData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      const totalAudi = audiData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      const totalConsolidado = consolidadoData.vendasNovos.vendas.reduce((sum, v) => sum + v, 0)
      
      console.log('=== PROBLEMA DE CONSOLIDAÇÃO ===')
      console.log('Total VW:', totalVW)
      console.log('Total Audi:', totalAudi, '(se zero, este é o problema!)')
      console.log('Total Consolidado:', totalConsolidado)
      console.log('Esperado (VW + Audi):', totalVW + totalAudi)
      
      // Se totalAudi === 0, então Consolidado === VW apenas
      if (totalAudi === 0) {
        console.log('⚠️ PROBLEMA IDENTIFICADO: Audi retorna dados zerados!')
        console.log('⚠️ Consolidado está mostrando apenas VW porque Audi não tem dados!')
      }
    })
  })
})
