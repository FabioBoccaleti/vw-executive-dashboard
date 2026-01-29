/**
 * Script para popular o banco de dados Redis com os dados padrão VW
 * Executa: npx tsx scripts/seedDatabase.ts
 */

// Dados consolidados (2025)
import { businessMetricsData } from '../src/data/businessMetricsData';
import { businessMetricsData2024 } from '../src/data/businessMetricsData2024';
import { businessMetricsData2026 } from '../src/data/businessMetricsData2026';
import { businessMetricsData2027 } from '../src/data/businessMetricsData2027';

// Dados por departamento - Novos
import { businessMetricsDataNovos2024 } from '../src/data/businessMetricsDataNovos2024';
import { businessMetricsDataNovos2025 } from '../src/data/businessMetricsDataNovos2025';
import { businessMetricsDataNovos2026 } from '../src/data/businessMetricsDataNovos2026';
import { businessMetricsDataNovos2027 } from '../src/data/businessMetricsDataNovos2027';

// Dados por departamento - Venda Direta
import { businessMetricsDataVendaDireta2024 } from '../src/data/businessMetricsDataVendaDireta2024';
import { businessMetricsDataVendaDireta2025 } from '../src/data/businessMetricsDataVendaDireta2025';
import { businessMetricsDataVendaDireta2026 } from '../src/data/businessMetricsDataVendaDireta2026';
import { businessMetricsDataVendaDireta2027 } from '../src/data/businessMetricsDataVendaDireta2027';

// Dados por departamento - Usados
import { businessMetricsDataUsados2024 } from '../src/data/businessMetricsDataUsados2024';
import { businessMetricsDataUsados2025 } from '../src/data/businessMetricsDataUsados2025';
import { businessMetricsDataUsados2026 } from '../src/data/businessMetricsDataUsados2026';
import { businessMetricsDataUsados2027 } from '../src/data/businessMetricsDataUsados2027';

// Dados por departamento - Peças
import { businessMetricsDataPecas2024 } from '../src/data/businessMetricsDataPecas2024';
import { businessMetricsDataPecas2025 } from '../src/data/businessMetricsDataPecas2025';
import { businessMetricsDataPecas2026 } from '../src/data/businessMetricsDataPecas2026';
import { businessMetricsDataPecas2027 } from '../src/data/businessMetricsDataPecas2027';

// Dados por departamento - Oficina
import { businessMetricsDataOficina2024 } from '../src/data/businessMetricsDataOficina2024';
import { businessMetricsDataOficina2025 } from '../src/data/businessMetricsDataOficina2025';
import { businessMetricsDataOficina2026 } from '../src/data/businessMetricsDataOficina2026';
import { businessMetricsDataOficina2027 } from '../src/data/businessMetricsDataOficina2027';

// Dados por departamento - Funilaria
import { businessMetricsDataFunilaria2024 } from '../src/data/businessMetricsDataFunilaria2024';
import { businessMetricsDataFunilaria2025 } from '../src/data/businessMetricsDataFunilaria2025';
import { businessMetricsDataFunilaria2026 } from '../src/data/businessMetricsDataFunilaria2026';
import { businessMetricsDataFunilaria2027 } from '../src/data/businessMetricsDataFunilaria2027';

// Dados por departamento - Administração
import { businessMetricsDataAdministracao2024 } from '../src/data/businessMetricsDataAdministracao2024';
import { businessMetricsDataAdministracao2025 } from '../src/data/businessMetricsDataAdministracao2025';
import { businessMetricsDataAdministracao2026 } from '../src/data/businessMetricsDataAdministracao2026';
import { businessMetricsDataAdministracao2027 } from '../src/data/businessMetricsDataAdministracao2027';

const API_BASE = 'https://spark-template-eight.vercel.app';

async function seedDatabase() {
  console.log('🚀 Iniciando população do banco de dados Redis...\n');

  // Mapeamento de dados por chave
  const dataMap: Record<string, any> = {
    // Dados consolidados (shared)
    'vw_metrics_shared_2024': businessMetricsData2024,
    'vw_metrics_shared_2025': businessMetricsData,
    'vw_metrics_shared_2026': businessMetricsData2026,
    'vw_metrics_shared_2027': businessMetricsData2027,

    // Novos
    'vw_metrics_2024_novos': businessMetricsDataNovos2024,
    'vw_metrics_2025_novos': businessMetricsDataNovos2025,
    'vw_metrics_2026_novos': businessMetricsDataNovos2026,
    'vw_metrics_2027_novos': businessMetricsDataNovos2027,

    // Venda Direta
    'vw_metrics_2024_vendaDireta': businessMetricsDataVendaDireta2024,
    'vw_metrics_2025_vendaDireta': businessMetricsDataVendaDireta2025,
    'vw_metrics_2026_vendaDireta': businessMetricsDataVendaDireta2026,
    'vw_metrics_2027_vendaDireta': businessMetricsDataVendaDireta2027,

    // Usados
    'vw_metrics_2024_usados': businessMetricsDataUsados2024,
    'vw_metrics_2025_usados': businessMetricsDataUsados2025,
    'vw_metrics_2026_usados': businessMetricsDataUsados2026,
    'vw_metrics_2027_usados': businessMetricsDataUsados2027,

    // Peças
    'vw_metrics_2024_pecas': businessMetricsDataPecas2024,
    'vw_metrics_2025_pecas': businessMetricsDataPecas2025,
    'vw_metrics_2026_pecas': businessMetricsDataPecas2026,
    'vw_metrics_2027_pecas': businessMetricsDataPecas2027,

    // Oficina
    'vw_metrics_2024_oficina': businessMetricsDataOficina2024,
    'vw_metrics_2025_oficina': businessMetricsDataOficina2025,
    'vw_metrics_2026_oficina': businessMetricsDataOficina2026,
    'vw_metrics_2027_oficina': businessMetricsDataOficina2027,

    // Funilaria
    'vw_metrics_2024_funilaria': businessMetricsDataFunilaria2024,
    'vw_metrics_2025_funilaria': businessMetricsDataFunilaria2025,
    'vw_metrics_2026_funilaria': businessMetricsDataFunilaria2026,
    'vw_metrics_2027_funilaria': businessMetricsDataFunilaria2027,

    // Administração
    'vw_metrics_2024_administracao': businessMetricsDataAdministracao2024,
    'vw_metrics_2025_administracao': businessMetricsDataAdministracao2025,
    'vw_metrics_2026_administracao': businessMetricsDataAdministracao2026,
    'vw_metrics_2027_administracao': businessMetricsDataAdministracao2027,
  };

  const items = Object.entries(dataMap).map(([key, value]) => ({ key, value }));
  
  console.log(`📋 Total de itens a serem enviados: ${items.length}\n`);

  // Envia em lotes de 5 para não sobrecarregar
  const batchSize = 5;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    try {
      const response = await fetch(`${API_BASE}/api/kv/bulk-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch }),
      });

      if (response.ok) {
        successCount += batch.length;
        console.log(`✅ Lote ${batchNum}: ${batch.map(b => b.key).join(', ')}`);
      } else {
        errorCount += batch.length;
        const errorText = await response.text();
        console.error(`❌ Lote ${batchNum} falhou: ${errorText}`);
      }
    } catch (error) {
      errorCount += batch.length;
      console.error(`❌ Lote ${batchNum} erro: ${error}`);
    }
  }

  console.log('\n========================================');
  console.log('📊 RESULTADO:');
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log('========================================\n');

  if (successCount > 0) {
    console.log('🎉 Banco de dados populado com sucesso!');
  }
}

// Executar
seedDatabase().catch(console.error);
