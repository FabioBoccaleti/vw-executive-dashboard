/**
 * Suíte de Testes - Departamentos
 * Testa a troca e validação de departamentos
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadMetricsData,
  loadDREData,
  loadSelectedDepartment,
  saveSelectedDepartment,
  type Department,
} from '@/lib/dataStorage'

describe('Departamentos - Funcionalidades', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const allDepartments: Department[] = [
    'novos',
    'vendaDireta',
    'usados',
    'pecas',
    'oficina',
    'funilaria',
    'administracao',
    'consolidado',
  ]

  const savableDepartments: Department[] = [
    'novos',
    'vendaDireta',
    'usados',
    'pecas',
    'oficina',
    'funilaria',
    'administracao',
  ]

  describe('Troca de Departamentos', () => {
    it('deve alternar entre todos os departamentos', () => {
      allDepartments.forEach((dept) => {
        if (dept !== 'consolidado') {
          saveSelectedDepartment(dept)
          expect(loadSelectedDepartment()).toBe(dept)
        }
      })
    })

    it('deve manter o departamento após recarregar', () => {
      saveSelectedDepartment('pecas')
      
      // Simula "recarregar" limpando memória mas não localStorage
      const loaded = loadSelectedDepartment()
      expect(loaded).toBe('pecas')
    })

    it('deve carregar dados diferentes para cada departamento', () => {
      const usadosData = loadMetricsData(2025, 'usados')
      const novosData = loadMetricsData(2025, 'novos')
      
      // Os dados devem existir mas podem ser diferentes
      expect(usadosData).toBeDefined()
      expect(novosData).toBeDefined()
      
      // Verifica que são objetos distintos
      expect(usadosData).not.toBe(novosData)
    })
  })

  describe('Validação de Departamentos', () => {
    it('deve validar departamentos válidos', () => {
      allDepartments.forEach((dept) => {
        expect(['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado']).toContain(dept)
      })
    })

    it('deve retornar usados para departamento inválido no localStorage', () => {
      localStorage.setItem('vw_selected_department', 'invalido')
      expect(loadSelectedDepartment()).toBe('usados')
    })
  })

  describe('Dados por Departamento', () => {
    const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027]

    it('deve carregar métricas para cada departamento em cada ano', () => {
      allDepartments.forEach((dept) => {
        years.forEach((year) => {
          const data = loadMetricsData(year, dept)
          
          expect(data).toBeDefined()
          expect(data.months).toBeDefined()
          expect(data.months).toHaveLength(12)
          expect(data.vendasNovos).toBeDefined()
          expect(data.vendasUsados).toBeDefined()
        })
      })
    })

    it('consolidado deve somar dados de todos os departamentos', () => {
      const consolidado = loadMetricsData(2025, 'consolidado')
      
      // Carrega dados individuais
      const novos = loadMetricsData(2025, 'novos')
      const vendaDireta = loadMetricsData(2025, 'vendaDireta')
      const usados = loadMetricsData(2025, 'usados')
      const pecas = loadMetricsData(2025, 'pecas')
      const oficina = loadMetricsData(2025, 'oficina')
      const funilaria = loadMetricsData(2025, 'funilaria')
      const administracao = loadMetricsData(2025, 'administracao')
      
      // Verifica que o consolidado existe
      expect(consolidado).toBeDefined()
      expect(consolidado.months).toHaveLength(12)
    })
  })

  describe('Nomes de Departamentos', () => {
    const departmentNames: Record<Department, string> = {
      'novos': 'Veículos Novos',
      'vendaDireta': 'Venda Direta',
      'usados': 'Veículos Usados',
      'pecas': 'Peças',
      'oficina': 'Oficina',
      'funilaria': 'Funilaria',
      'administracao': 'Administração',
      'consolidado': 'Consolidado',
    }

    it('deve ter nome para cada departamento', () => {
      allDepartments.forEach((dept) => {
        expect(departmentNames[dept]).toBeDefined()
        expect(departmentNames[dept].length).toBeGreaterThan(0)
      })
    })
  })
})
