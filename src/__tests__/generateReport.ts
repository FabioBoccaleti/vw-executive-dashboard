/**
 * Gerador de Relatório HTML de Testes
 * 
 * Este script executa os testes e gera um relatório HTML detalhado.
 * Uso: npx tsx src/__tests__/generateReport.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  ancestorTitles: string[];
  fullName: string;
  status: 'passed' | 'failed' | 'skipped';
  title: string;
  duration: number;
  failureMessages: string[];
}

interface TestFile {
  assertionResults: TestResult[];
  startTime: number;
  endTime: number;
  status: string;
  name: string;
}

interface TestOutput {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: TestFile[];
  startTime: number;
  success: boolean;
}

function generateHTML(data: TestOutput): string {
  const totalTests = data.numTotalTests;
  const passedTests = data.numPassedTests;
  const failedTests = data.numFailedTests;
  const skippedTests = data.numPendingTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(2);
  
  const totalDuration = data.testResults.reduce((acc, file) => {
    return acc + (file.endTime - file.startTime);
  }, 0);

  // Agrupar testes por arquivo
  const testsByFile = data.testResults.map(file => {
    const fileName = path.basename(file.name);
    const tests = file.assertionResults;
    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    
    // Agrupar por describe
    const testsByDescribe: Record<string, TestResult[]> = {};
    tests.forEach(test => {
      const describe = test.ancestorTitles.join(' > ') || 'Sem grupo';
      if (!testsByDescribe[describe]) {
        testsByDescribe[describe] = [];
      }
      testsByDescribe[describe].push(test);
    });
    
    return {
      fileName,
      fullPath: file.name,
      tests,
      passed,
      failed,
      total: tests.length,
      duration: file.endTime - file.startTime,
      testsByDescribe
    };
  });

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Testes - VW Financial Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e0e0e0;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      text-align: center;
      padding: 40px 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      margin-bottom: 30px;
      backdrop-filter: blur(10px);
    }
    
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .timestamp {
      color: #888;
      font-size: 0.9rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 40px rgba(0,212,255,0.2);
    }
    
    .stat-value {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .stat-label {
      color: #888;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 1px;
    }
    
    .passed .stat-value { color: #00ff88; }
    .failed .stat-value { color: #ff4757; }
    .skipped .stat-value { color: #ffa502; }
    .total .stat-value { color: #00d4ff; }
    .rate .stat-value { color: #a29bfe; }
    .duration .stat-value { color: #fd79a8; font-size: 2rem; }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      margin: 20px 0;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00ff88, #00d4ff);
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    
    .file-section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .file-header {
      padding: 20px;
      background: rgba(255,255,255,0.05);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.3s;
    }
    
    .file-header:hover {
      background: rgba(255,255,255,0.1);
    }
    
    .file-name {
      font-weight: 600;
      font-size: 1.1rem;
      color: #00d4ff;
    }
    
    .file-stats {
      display: flex;
      gap: 15px;
      font-size: 0.9rem;
    }
    
    .file-stats span {
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(255,255,255,0.1);
    }
    
    .file-stats .passed-count { color: #00ff88; }
    .file-stats .failed-count { color: #ff4757; }
    
    .file-content {
      padding: 0;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    
    .file-section.expanded .file-content {
      max-height: 10000px;
      padding: 20px;
    }
    
    .describe-group {
      margin-bottom: 20px;
    }
    
    .describe-title {
      font-size: 0.95rem;
      color: #a29bfe;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 10px;
    }
    
    .test-item {
      display: flex;
      align-items: center;
      padding: 10px 15px;
      margin: 5px 0;
      border-radius: 8px;
      background: rgba(255,255,255,0.03);
      transition: background 0.2s;
    }
    
    .test-item:hover {
      background: rgba(255,255,255,0.08);
    }
    
    .test-status {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 15px;
      font-size: 14px;
    }
    
    .test-status.passed {
      background: rgba(0,255,136,0.2);
      color: #00ff88;
    }
    
    .test-status.failed {
      background: rgba(255,71,87,0.2);
      color: #ff4757;
    }
    
    .test-title {
      flex: 1;
      font-size: 0.9rem;
    }
    
    .test-duration {
      color: #666;
      font-size: 0.8rem;
      margin-left: 10px;
    }
    
    .failure-message {
      background: rgba(255,71,87,0.1);
      border-left: 3px solid #ff4757;
      padding: 15px;
      margin-top: 10px;
      border-radius: 0 8px 8px 0;
      font-family: monospace;
      font-size: 0.85rem;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 30px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      overflow: hidden;
    }
    
    .summary-table th,
    .summary-table td {
      padding: 15px 20px;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .summary-table th {
      background: rgba(255,255,255,0.08);
      font-weight: 600;
      color: #00d4ff;
    }
    
    .summary-table tr:hover {
      background: rgba(255,255,255,0.03);
    }
    
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .badge-success {
      background: rgba(0,255,136,0.2);
      color: #00ff88;
    }
    
    .badge-danger {
      background: rgba(255,71,87,0.2);
      color: #ff4757;
    }
    
    footer {
      text-align: center;
      padding: 40px;
      color: #666;
      font-size: 0.85rem;
    }
    
    .expand-all {
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      border: none;
      padding: 10px 25px;
      border-radius: 25px;
      color: #1a1a2e;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .expand-all:hover {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(0,212,255,0.3);
    }
    
    @media (max-width: 768px) {
      h1 { font-size: 1.8rem; }
      .stat-value { font-size: 2rem; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Relatório de Testes</h1>
      <p style="color: #00d4ff; font-size: 1.2rem; margin: 10px 0;">VW Financial Dashboard</p>
      <p class="timestamp">Gerado em: ${now}</p>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-value">${totalTests}</div>
        <div class="stat-label">Total de Testes</div>
      </div>
      <div class="stat-card passed">
        <div class="stat-value">${passedTests}</div>
        <div class="stat-label">Aprovados</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${failedTests}</div>
        <div class="stat-label">Falharam</div>
      </div>
      <div class="stat-card skipped">
        <div class="stat-value">${skippedTests}</div>
        <div class="stat-label">Ignorados</div>
      </div>
      <div class="stat-card rate">
        <div class="stat-value">${successRate}%</div>
        <div class="stat-label">Taxa de Sucesso</div>
      </div>
      <div class="stat-card duration">
        <div class="stat-value">${(totalDuration / 1000).toFixed(2)}s</div>
        <div class="stat-label">Duração Total</div>
      </div>
    </div>
    
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${successRate}%"></div>
    </div>
    
    <h2 style="margin: 30px 0 20px; color: #00d4ff;">📁 Arquivos de Teste</h2>
    
    <button class="expand-all" onclick="toggleAll()">Expandir/Recolher Todos</button>
    
    ${testsByFile.map(file => `
    <div class="file-section" onclick="toggleFile(this)">
      <div class="file-header">
        <span class="file-name">📄 ${file.fileName}</span>
        <div class="file-stats">
          <span class="passed-count">✓ ${file.passed}</span>
          ${file.failed > 0 ? `<span class="failed-count">✗ ${file.failed}</span>` : ''}
          <span style="color: #888">${(file.duration / 1000).toFixed(2)}s</span>
        </div>
      </div>
      <div class="file-content">
        ${Object.entries(file.testsByDescribe).map(([describe, tests]) => `
        <div class="describe-group">
          <div class="describe-title">🏷️ ${describe}</div>
          ${tests.map(test => `
          <div class="test-item">
            <div class="test-status ${test.status}">${test.status === 'passed' ? '✓' : '✗'}</div>
            <div class="test-title">${test.title}</div>
            <div class="test-duration">${test.duration.toFixed(2)}ms</div>
          </div>
          ${test.failureMessages.length > 0 ? `
          <div class="failure-message">${test.failureMessages.join('\\n')}</div>
          ` : ''}
          `).join('')}
        </div>
        `).join('')}
      </div>
    </div>
    `).join('')}
    
    <h2 style="margin: 40px 0 20px; color: #00d4ff;">📈 Resumo por Arquivo</h2>
    
    <table class="summary-table">
      <thead>
        <tr>
          <th>Arquivo</th>
          <th>Total</th>
          <th>Aprovados</th>
          <th>Falharam</th>
          <th>Taxa</th>
          <th>Duração</th>
        </tr>
      </thead>
      <tbody>
        ${testsByFile.map(file => `
        <tr>
          <td>${file.fileName}</td>
          <td>${file.total}</td>
          <td><span class="badge badge-success">${file.passed}</span></td>
          <td>${file.failed > 0 ? `<span class="badge badge-danger">${file.failed}</span>` : '0'}</td>
          <td>${((file.passed / file.total) * 100).toFixed(1)}%</td>
          <td>${(file.duration / 1000).toFixed(2)}s</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <footer>
      <p>Gerado automaticamente pela suíte de testes Vitest</p>
      <p style="margin-top: 10px">VW Financial Dashboard © ${new Date().getFullYear()}</p>
    </footer>
  </div>
  
  <script>
    function toggleFile(element) {
      element.classList.toggle('expanded');
    }
    
    function toggleAll() {
      const sections = document.querySelectorAll('.file-section');
      const anyExpanded = Array.from(sections).some(s => s.classList.contains('expanded'));
      sections.forEach(s => {
        if (anyExpanded) {
          s.classList.remove('expanded');
        } else {
          s.classList.add('expanded');
        }
      });
    }
    
    // Expandir automaticamente arquivos com falhas
    document.querySelectorAll('.file-section').forEach(section => {
      if (section.querySelector('.failed-count')) {
        section.classList.add('expanded');
      }
    });
  </script>
</body>
</html>`;
}

async function main() {
  console.log('🧪 Executando testes...');
  
  try {
    // Executa testes com saída JSON
    const result = execSync('npm test -- --reporter=json', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Parse do resultado JSON
    const jsonMatch = result.match(/\{[\s\S]*\}$/);
    if (!jsonMatch) {
      throw new Error('Não foi possível parsear o resultado dos testes');
    }
    
    const testData: TestOutput = JSON.parse(jsonMatch[0]);
    
    // Gera HTML
    const html = generateHTML(testData);
    
    // Salva arquivo
    const outputPath = path.join(__dirname, 'test-report.html');
    fs.writeFileSync(outputPath, html);
    
    console.log(`✅ Relatório gerado: ${outputPath}`);
    console.log(`📊 Total: ${testData.numTotalTests} testes`);
    console.log(`✓ Aprovados: ${testData.numPassedTests}`);
    console.log(`✗ Falharam: ${testData.numFailedTests}`);
    
  } catch (error: any) {
    // Se os testes falharam mas temos output, ainda geramos o relatório
    if (error.stdout) {
      const jsonMatch = error.stdout.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        const testData: TestOutput = JSON.parse(jsonMatch[0]);
        const html = generateHTML(testData);
        const outputPath = path.join(__dirname, 'test-report.html');
        fs.writeFileSync(outputPath, html);
        console.log(`⚠️ Relatório gerado com falhas: ${outputPath}`);
        return;
      }
    }
    console.error('❌ Erro ao gerar relatório:', error.message);
  }
}

main();
