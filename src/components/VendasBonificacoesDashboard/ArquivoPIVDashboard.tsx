import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker as createTesseractWorker } from 'tesseract.js';
import { Upload, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  loadArquivoPivData, saveArquivoPivData,
  type ArquivoPivData, type ArquivoPivHeader,
  type ArquivoPivResumo, type ArquivoPivCriterioSat, type ArquivoPivRow,
} from './arquivoPivStorage';
import { periodoKey } from './provisaoPivStorage';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

// ─── Helpers de formatação ────────────────────────────────────────────────────
function parseCurrency(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/R\$\s*/g, '').trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}
function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtCurrencyStr(v: string) {
  if (!v) return '—';
  const n = parseCurrency(v);
  return n === 0 ? (v || '—') : fmtBRL(n);
}

// ─── Extração de texto nativo (pdfjs) ────────────────────────────────────────
async function extractNativeLines(pdf: pdfjsLib.PDFDocumentProxy): Promise<string[]> {
  type Item = { x: number; y: number; str: string };
  type Line = { y: number; items: Item[] };
  let allItems: Item[] = [];
  let yOffset = 0;
  let rawCount = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page     = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content  = await page.getTextContent();
    rawCount += content.items.length;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = (item as { str: string }).str.trim();
      if (!str) continue;
      const t = (item as { transform: number[] }).transform;
      allItems.push({ x: t[4], y: viewport.height - t[5] + yOffset, str });
    }
    yOffset += viewport.height + 20;
  }
  console.log('[ArquivoPIV] páginas:', pdf.numPages, '| raw items:', rawCount, '| filtered:', allItems.length);
  if (allItems.length === 0) return [];
  const sorted = [...allItems].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(item.y - last.y) <= 12) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  return lines
    .map(l => l.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// ─── OCR via Tesseract (PDF baseado em imagem) ───────────────────────────────
async function extractOCRLines(
  pdf: pdfjsLib.PDFDocumentProxy,
  onProgress: (msg: string) => void,
): Promise<string[]> {
  onProgress('PDF sem texto — iniciando OCR (pode demorar)...');
  const scale  = 2.5;
  const worker = await createTesseractWorker('eng');
  const allLines: string[] = [];
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress(`OCR — página ${pageNum} de ${pdf.numPages}...`);
      const page     = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas   = document.createElement('canvas');
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      const ctx      = canvas.getContext('2d')!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const { data: { text } } = await worker.recognize(canvas);
      console.log('[ArquivoPIV OCR] página', pageNum, '— chars:', text.length);
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      allLines.push(...lines);
    }
  } finally {
    await worker.terminate();
  }
  return allLines;
}

// ─── Parsers a partir de linhas de texto ─────────────────────────────────────
function extractHeader(textLines: string[]): ArquivoPivHeader {
  const head = textLines.slice(0, 80).join('\n');
  const get  = (re: RegExp) => { const m = head.match(re); return m ? (m[1] || '').trim() : ''; };
  const dataEmissao      = get(/DT\.?\s*EMISS[ÃA]O[:\s.]+(\d{2}[./]\d{2}[./]\d{4})/i);
  const horaEmissao      = get(/HORA[:\s.]+(\d{2}:\d{2}:\d{2})/i);
  const mesRaw           = get(/M[eê]s\s+Apurado\s*[:\s]+([^\n]+)/i);
  const mesApurado       = mesRaw.replace(/[^\d/]/g, '').replace(/\/+/g, '/');
  const dnLine           = textLines.slice(0, 80).find(l => /^DN\s+\d+/i.test(l));
  const dn               = dnLine || get(/\b(DN\s+\d+[^\n]*)/i);
  const cnpj             = get(/CNPJ[:\s]+(\d{2}\.?\d{3}\.?\d{3}\/\d{4}-\d{2})/i);
  const valorCredito     = get(/Valor\s+do\s+Cr[eé]dito\s+(R\$\s*[\d.,]+)/i).replace(/\s+/g, ' ');
  const creditoAtacado   = get(/Cr[eé]dito\s+do\s+Crit[eé]rio\s+Atacado\s+(R\$\s*[\d.,]+)/i).replace(/\s+/g, ' ');
  const creditoSatisfacao = get(/Pesquisa\s+de\s+Satisfa[cç][aã]o\s+(R\$\s*[\d.,]+)/i).replace(/\s+/g, ' ');
  return { dn, cnpj, valorCredito, creditoAtacado, creditoSatisfacao, mesApurado, dataEmissao, horaEmissao };
}

function extractResumo(textLines: string[]): ArquivoPivResumo {
  const atacadoIdx = textLines.findIndex(t => /resumo.*crit.*atacado/i.test(t));
  const satIdx     = textLines.findIndex(t => /resumo.*crit.*satisfa/i.test(t));
  const criterioAtacadoPct    = atacadoIdx >= 0 ? (textLines[atacadoIdx].match(/\(([^)]+)\)/)?.[1] ?? '') : '';
  const criterioSatisfacaoPct = satIdx >= 0     ? (textLines[satIdx].match(/\(([^)]+)\)/)?.[1] ?? '')     : '';
  const motivoRe = /^\d{2}\s*[:–-]\s*.+/;
  const motivosAtacado: string[] = [];
  if (atacadoIdx >= 0) {
    const end = satIdx >= 0 ? satIdx : atacadoIdx + 20;
    for (let i = atacadoIdx + 1; i < Math.min(end, textLines.length); i++) {
      if (motivoRe.test(textLines[i])) motivosAtacado.push(textLines[i]);
    }
  }
  const motivosSatisfacao: string[] = [];
  if (satIdx >= 0) {
    const periodIdx = textLines.findIndex((t, i) => i > satIdx && /^PER[IÍ]ODO/i.test(t));
    const end = periodIdx >= 0 ? periodIdx : satIdx + 20;
    for (let i = satIdx + 1; i < Math.min(end, textLines.length); i++) {
      if (motivoRe.test(textLines[i])) motivosSatisfacao.push(textLines[i]);
    }
  }
  return { criterioAtacadoPct, motivosAtacado, criterioSatisfacaoPct, motivosSatisfacao };
}

function extractCriterioSat(textLines: string[]): ArquivoPivCriterioSat {
  const periodIdx = textLines.findIndex(t => /^PER[IÍ]ODO/i.test(t));
  if (periodIdx < 0) return { periodo: '', notaDN: '', notaReg: '', bonif: '', motivo: '' };
  let dataIdx = periodIdx + 1;
  while (dataIdx < textLines.length && !textLines[dataIdx].trim()) dataIdx++;
  const parts = (textLines[dataIdx] || '').split(/\s+/).filter(Boolean);
  let motivo = '';
  for (let i = dataIdx + 1; i < Math.min(dataIdx + 5, textLines.length); i++) {
    if (/motivo\s*:/i.test(textLines[i])) { motivo = textLines[i].replace(/motivo\s*:\s*/i, '').trim(); break; }
  }
  return { periodo: parts[0] || '', notaDN: parts[1] || '', notaReg: parts[2] || '', bonif: parts[3] || '', motivo };
}

function normalizeOCRLine(line: string): string {
  return line
    // ── 0. Chassi OCR: "0BW..." → "9BW..." (OCR confunde 9 com 0 no VIN) ────────────
    .replace(/\b0(BW[A-Z0-9]{14})\b/gi, '9$1')

    // ── 1a. Critério colado ao preço com vírgula: "119.990,00150" → "119.990,00 150" ─
    .replace(/(,\d{2})(150|050)\b/g, '$1 $2')

    // ── 1b. Critério colado ao preço sem vírgula: "119.99000150" → "119.990,00 150" ──
    .replace(/(\d{2,3}\.\d{3})00(150|050)\b/g, '$1,00 $2')
    .replace(/(\d{5,6})00(150|050)\b/g, (_, n, c) => {
      const s = n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${s},00 ${c}`;
    })

    // ── 4. Símbolo R$ corrompido — DEVE VIR ANTES das regras de formato (2,3,3b) ──────
    // Sem consumir o dígito seguinte (usa lookahead)
    .replace(/\bRS§\s*/g, 'R$ ')
    .replace(/R\$§\s*/g, 'R$ ')
    .replace(/\bR[S§58E]\$\s*/g, 'R$ ')
    .replace(/\bR[S§58E]\s*(?=\d)/g, 'R$ ')    // RS, R§, R8, RE + dígito → R$
    // R$ correto mas grudado no número (sem espaço): "R$562" → "R$ 562"
    .replace(/R\$(?=\d)/g, 'R$ ')

    // ── 1c. Ponto no lugar da vírgula no preço com critério colado: ─────────────────
    // "R$119.990.00 150" → "R$119.990,00 150"  (dois pontos no preço)
    .replace(/(\d{1,3}\.\d{3})\.00(\s+(?:150|050))/g, '$1,00$2')
    // "R$ 167.990.00150" → "R$ 167.990,00 150"
    .replace(/(\d{1,3}\.\d{3})\.00(150|050)\b/g, '$1,00 $2')

    // ── 1d. Bônus de satisfação colado na data: "R$ 10126513022026" → "R$ 101265 13/02/2026" ─
    // OCR juntou os 6 dígitos do bônus com os 8 dígitos da data DDMMYYYY sem separação
    .replace(
      /R\$ (\d{5,6})((?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])202\d)\b/g,
      (_, bonus, date) => {
        const d = date.slice(0,2), m = date.slice(2,4), y = date.slice(4);
        return `R$ ${bonus} ${d}/${m}/${y}`;
      }
    )

    // ── 2. Vírgula e ponto trocados pelo OCR: "R$ 2,579.25" → "R$ 2.579,25" ─────────
    .replace(/R\$\s*(\d{1,3}),(\d{3})\.(\d{2})\b/g, 'R$ $1.$2,$3')

    // ── 2b. Dois pontos como separador decimal ────────────────────────────────────────
    // "R$ 2.672:35" (colon após milhar) → "R$ 2.672,35"
    .replace(/R\$ ([\d.]+):(\d{2})\b(?![,\d])/g, 'R$ $1,$2')
    // "R$ 2:37240" (colon no início) → "R$ 2.37240" (para regras subsequentes)
    .replace(/R\$ (\d+):(\d+)/g, 'R$ $1.$2')

    // ── 3. Espaço no lugar da vírgula decimal: "R$ 1.458 45" → "R$ 1.458,45" ─────────
    .replace(/R\$\s*(\d+\.\d{3})\s+(\d{2})\b/g, 'R$ $1,$2')

    // ── 3b. Vírgula omitida após ponto de milhar: "R$ 2.60925" → "R$ 2.609,25" ───────
    .replace(/R\$\s*(\d{1,3})\.(\d{3})(\d{2})\b(?![,.\d])/g, 'R$ $1.$2,$3')

    // ── 3c. Dois pontos (X.YY.ZZ): "R$ 1.00.70" → "R$ 1.000,70" ────────────────────
    // OCR omitiu dígito do milhar e trocou vírgula por ponto
    .replace(/R\$ (\d{1,3})\.(\d{2})\.(\d{2})\b(?![,.\d])/g, 'R$ $1.0$2,$3')

    // ── 4b. Preço sem pontuação: "R$ 9536000" → "R$ 95.360,00" ──────────────────────
    .replace(/R\$ (\d{4,6})00\b(?![,.\d])/g, (_, n) => {
      const s = n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `R$ ${s},00`;
    })

    // ── 5. Ponto no lugar da vírgula decimal ─────────────────────────────────────────
    // 5a. X.XXX.XX → X.XXX,XX
    .replace(/R\$ (\d{1,3}\.\d{3})\.(\d{2})\b(?![,.\d])/g, 'R$ $1,$2')
    // 5b. NNNN.NN → NNNN,NN
    .replace(/R\$ (\d{1,4})\.(\d{2})\b(?![,.\d])/g, 'R$ $1,$2')

    // ── 6. Vírgula completamente omitida: "R$ 67295" → "R$ 672,95" ───────────────────
    .replace(/R\$ (\d{5,6})\b(?![,.\d])/g, (_, n) => `R$ ${n.slice(0, -2)},${n.slice(-2)}`)

    // ── 7. Vírgula decimal omitida no preço com ponto de milhar ──────────────────────
    .replace(/(\d{2,3}\.\d{3})00\b(?!\s*\d)/g, '$1,00')

    // ── 7b. Bônus com 5 dígitos (OCR inseriu dígito extra): "R$ 25546,10" → "R$ 2.546,10"
    .replace(/R\$ (\d{5}),(\d{2})\b/g, (full, n, cents) => {
      const val = parseInt(n, 10);
      if (val > 4999 && val < 50000) {
        const candidate = n[0] + n.slice(2);
        const candVal = parseInt(candidate, 10);
        if (candVal >= 300 && candVal <= 5000) {
          const s = candVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          return `R$ ${s},${cents}`;
        }
      }
      return full;
    })

    // ── 8a. Datas com "0" no lugar de "/": "220012026" → "22/01/2026" ──────────────────
    .replace(/\b(\d{2})0(\d{2})0(\d{4})\b/g, (full, d, m, y) => {
      const day = parseInt(d, 10), mon = parseInt(m, 10), yr = parseInt(y, 10);
      if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && yr >= 2020 && yr <= 2030)
        return `${d}/${m}/${y}`;
      return full;
    })

    // ── 8b. Data parcialmente colada: "2301/2026" → "23/01/2026" ─────────────────────
    .replace(/\b(\d{2})(\d{2})\/(\d{4})\b/g, (full, d, m, y) => {
      const day = parseInt(d, 10), mon = parseInt(m, 10), yr = parseInt(y, 10);
      if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && yr >= 2020 && yr <= 2030)
        return `${d}/${m}/${y}`;
      return full;
    })

    // ── 8. Datas sem separador: "14012026" → "14/01/2026" ────────────────────────────
    .replace(/\b(\d{2})(\d{2})(\d{4})\b(?![-/])/g, (full, d, m, y) => {
      const day = parseInt(d, 10), mon = parseInt(m, 10), yr = parseInt(y, 10);
      if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && yr >= 2020 && yr <= 2030)
        return `${d}/${m}/${y}`;
      return full;
    })

    // ── 9. Critério decimal isolado ──────────────────────────────────────────────────
    .replace(/(?<![.,\d])150(?![.,\d])/g, '1.50')
    .replace(/(?<![.,\d])050(?![.,\d])/g, '0.50')
    .replace(/\b1,50\b/g, '1.50')
    .replace(/\b0,50\b/g, '0.50')
    .replace(/\b1\s+50\b/g, '1.50')
    .replace(/\b0\s+50\b/g, '0.50');
}

function parseDataRowFromText(line: string): ArquivoPivRow | null {
  line = normalizeOCRLine(line);

  // VIN = 17 chars no padrão, mas OCR pode omitir ou inserir 1 char → aceita 15–18.
  // Aceita qualquer fabricante: 9BW (Brasil), 8AN/SAN (Argentina), 3VW/3WS/3WIN (México/DE).
  // Case-insensitive para capturar OCR com letra minúscula (ex: "3WSTe5N...").
  const vinMatch = line.match(/\b([A-Z0-9]{15,18})\b/i);
  if (!vinMatch) return null;
  // Sanidade: deve ter letras E dígitos (exclui sequências puramente numéricas ou textuais)
  const vin = vinMatch[1].toUpperCase();
  if (!/[A-Z]/.test(vin) || !/[0-9]/.test(vin)) return null;
  // Sanidade extra: deve ter ao menos 4 letras (evita falsos positivos como preços/datas)
  if ((vin.match(/[A-Z]/g) || []).length < 4) return null;
  const chassi      = vin;
  const beforeVin   = line.slice(0, vinMatch.index!).trim();
  const monthMatch  = beforeVin.match(/(\d{1,2})\s*$/);
  const mes         = monthMatch ? monthMatch[1] : '';
  const afterVin    = line.slice(vinMatch.index! + chassi.length).trim();

  // ── Classificação por MAGNITUDE + ORDEM DOCUMENTAL ───────────────────────
  // Preço Público VW é sempre > R$ 50.000 (mínimo ~R$ 70k em 2025).
  // Bônus atacado (1.50%) e satisfação (0.50%) são sempre < R$ 10.000.
  // OCR pode corromper valores (ex: 2.546 → 25.546) levantando-os acima de 10k,
  // mas nunca acima de 50k — por isso usamos 50.000 como limiar seguro.
  // A ordem no documento é sempre: Preço → Bônus Atacado → Bônus Satisfação.
  // Portanto preservamos a ordem original para os bônus (não ordenamos por valor).
  type CurrEntry = { raw: string; val: number };
  const allCurr: CurrEntry[] = [...afterVin.matchAll(/R\$\s*([\d.]+,\d{2})/g)]
    .map(m => ({ raw: `R$ ${m[1]}`, val: parseCurrency(`R$ ${m[1]}`) }));

  // Preço: primeiro valor > 50.000 (em ordem de aparição no documento)
  const precoIdx   = allCurr.findIndex(e => e.val > 50000);
  const precoPublico = precoIdx >= 0 ? allCurr[precoIdx].raw : '';

  // Bônus: demais entradas em ordem documental (posição original)
  const bonusEntries = allCurr.filter((_, i) => i !== precoIdx);
  const valorBonusAtacado    = bonusEntries[0]?.raw ?? '';
  const valorBonusSatisfacao = bonusEntries[1]?.raw ?? '';

  // Model group: texto antes do primeiro R$ em afterVin
  const firstRIdx  = afterVin.search(/R\$/);
  const modelGroup = firstRIdx > 0 ? afterVin.slice(0, firstRIdx).trim() : '';

  const dateMatches            = [...afterVin.matchAll(/\d{2}\/\d{2}\/\d{4}/g)];
  const dataFaturamentoAtacado = dateMatches[0]?.[0] || '';
  const dataVendaVarejo        = dateMatches[1]?.[0] || '';
  const dataEmplacamento       = dateMatches[2]?.[0] || '';

  let cidadeEstado = '';
  if (dateMatches[2]) {
    const lastIdx = afterVin.lastIndexOf(dateMatches[2][0]);
    cidadeEstado  = afterVin.slice(lastIdx + dateMatches[2][0].length).trim();
  }

  const simNao                 = [...afterVin.matchAll(/\b(Sim|N[aã]o)\b/gi)].map(m => m[1]);
  const direitoBonusAtacado    = simNao[0] || '';
  const direitoBonusSatisfacao = simNao[1] || '';

  // Remove valores monetários antes de buscar critérios decimais (evita falsos positivos)
  const afterVinNoCurr = afterVin.replace(/R\$\s*[\d.]+,\d{2}/g, '');
  const critMatches    = [...afterVinNoCurr.matchAll(/\b([0-3]\.[0-9]{2})\b/g)];
  let critAtacado    = critMatches[0]?.[1] || '';
  let critSatisfacao = critMatches[1]?.[1] || '';

  let dirAtacado  = simNao[0] || '';
  let dirSatisf   = simNao[1] || '';
  let valAtacado  = valorBonusAtacado;
  let valSatisf   = valorBonusSatisfacao;

  const motivoMatches = [...afterVin.matchAll(/N[aã]o\s+(\d{2})\s+R\$/gi)];
  let motivoPenalizacaoAtacado    = '';
  let motivoPenalizacaoSatisfacao = '';
  if (motivoMatches.length === 1) {
    if (/^n/i.test(dirAtacado)) motivoPenalizacaoAtacado = motivoMatches[0][1];
    else motivoPenalizacaoSatisfacao = motivoMatches[0][1];
  } else if (motivoMatches.length >= 2) {
    motivoPenalizacaoAtacado    = motivoMatches[0][1];
    motivoPenalizacaoSatisfacao = motivoMatches[1][1];
  }

  // ── Correção de slot ──────────────────────────────────────────────────────
  // Se o único critério encontrado é "0.50", o OCR omitiu os dados de atacado
  // e o que está no slot atacado pertence à satisfação — fazer o swap.
  if (critAtacado === '0.50' && critSatisfacao === '') {
    critSatisfacao          = critAtacado;  critAtacado = '';
    dirSatisf               = dirAtacado;   dirAtacado  = '';
    valSatisf               = valAtacado;   valAtacado  = '';
    motivoPenalizacaoSatisfacao = motivoPenalizacaoAtacado;
    motivoPenalizacaoAtacado    = '';
  }

  // ── Validação por cálculo (detecta erros de dígito OCR) ──────────────────
  // OCR pode misler um dígito (ex: 869 → 860). Como preço × critério é determinístico,
  // recalculamos o valor esperado. Se diferir < 2% do OCR, preferimos o valor calculado.
  // O PDF usa truncamento (floor) nos centavos, não arredondamento.
  // Ex: 148.849 × 1.5% = 2.232,735 → trunca → 2.232,73 (não 2.232,74)
  // O epsilon 1e-9 corrige imprecisão de ponto flutuante binário:
  // Ex: 212.270 × 0.5% = 1061.3499999999999 em float → sem epsilon truncaria para 1061,34 errado.
  const calcBRL = (n: number): string => {
    const truncated = Math.floor(n * 100 + 1e-9) / 100;
    const [int, dec] = truncated.toFixed(2).split('.');
    return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
  };
  const precoVal = parseCurrency(precoPublico);
  if (precoVal > 0) {
    const critAtacadoNum = parseFloat(critAtacado);
    if (critAtacadoNum > 0) {
      const expected = precoVal * (critAtacadoNum / 100);
      if (valAtacado) {
        // Corrige erros de dígito OCR até 20% de desvio (cobre desde 0.01 até 1 dígito errado)
        const ocr = parseCurrency(valAtacado);
        if (ocr > 0 && Math.abs(expected - ocr) / expected < 0.20) {
          valAtacado = calcBRL(expected);
        }
      } else if (/^sim$/i.test(dirAtacado)) {
        // Bônus garantido (Sim) mas OCR não parseável → força pelo cálculo
        valAtacado = calcBRL(expected);
      }
    }
    const critSatNum = parseFloat(critSatisfacao);
    if (critSatNum > 0) {
      const expected = precoVal * (critSatNum / 100);
      if (valSatisf) {
        const ocr = parseCurrency(valSatisf);
        if (ocr > 0 && Math.abs(expected - ocr) / expected < 0.20) {
          valSatisf = calcBRL(expected);
        }
      } else if (/^sim$/i.test(dirSatisf)) {
        valSatisf = calcBRL(expected);
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    mes, chassi, modelGroup,
    precoPublico,
    critAtacado,    direitoBonusAtacado: dirAtacado,   motivoPenalizacaoAtacado,    valorBonusAtacado: valAtacado,
    critSatisfacao, direitoBonusSatisfacao: dirSatisf, motivoPenalizacaoSatisfacao, valorBonusSatisfacao: valSatisf,
    dataFaturamentoAtacado, dataVendaVarejo, dataEmplacamento, cidadeEstado,
  };
}

// ─── Parse principal ──────────────────────────────────────────────────────────
async function parseArquivoPIV(
  file: File,
  onProgress: (msg: string) => void,
): Promise<{ data: ArquivoPivData; debugLines: string[] }> {
  onProgress('Lendo PDF...');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  onProgress(`Extraindo ${pdf.numPages} página(s)...`);
  let textLines = await extractNativeLines(pdf);

  if (textLines.length < 5) {
    textLines = await extractOCRLines(pdf, onProgress);
  }

  console.log('[ArquivoPIV] Total linhas:', textLines.length);

  onProgress('Processando cabeçalho...');
  const header = extractHeader(textLines);

  onProgress('Processando resumo dos critérios...');
  const resumo = extractResumo(textLines);

  onProgress('Processando critério de satisfação...');
  const criterioSat = extractCriterioSat(textLines);

  onProgress('Processando linhas de chassi...');
  const rows: ArquivoPivRow[] = [];
  for (const line of textLines) {
    const row = parseDataRowFromText(line);
    if (row) {
      // Log diagnóstico: satisfação vazia mas dir.bônus = Sim
      if (/^sim$/i.test(row.direitoBonusSatisfacao) && !row.valorBonusSatisfacao) {
        console.warn('[ArquivoPIV DIAG] Satisfação em branco — chassi:', row.chassi, '| linha normalizada:', normalizeOCRLine(line));
      }
      rows.push(row);
    }
  }

  const debugLines = textLines.map((l, i) => `[${i}] ${l}`);
  console.log('[ArquivoPIV] Debug linhas:', debugLines);
  console.log('[ArquivoPIV] Header:', header);
  console.log('[ArquivoPIV] Rows:', rows.length);

  let pk = '';
  const mesMatch = header.mesApurado.match(/(\d{1,2})\/(\d{4})/);
  if (mesMatch) pk = `${mesMatch[2]}-${mesMatch[1].padStart(2, '0')}`;

  const data: ArquivoPivData = {
    header, resumo, criterioSat, rows,
    importedAt: new Date().toISOString(),
    fileName: file.name,
    periodoKey: pk,
  };
  return { data, debugLines };
}

// ─── Exportação Excel ────────────────────────────────────────────────────────
async function exportToExcel(data: ArquivoPivData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  const mes = data.header.mesApurado || data.periodoKey || '';
  const ws = wb.addWorksheet('PIV', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF4F46E5' } },
  });

  const COLS = [
    { label: 'Mês',                  key: 'mes',                       type: 'text',     width: 6  },
    { label: 'Chassi',               key: 'chassi',                    type: 'text',     width: 20 },
    { label: 'Model Group',          key: 'modelGroup',                type: 'text',     width: 16 },
    { label: 'Preço Público',        key: 'precoPublico',              type: 'currency', width: 16 },
    { label: 'Crit. Atacado',        key: 'critAtacado',               type: 'number',   width: 12 },
    { label: 'Dir. Bônus Atacado',   key: 'direitoBonusAtacado',       type: 'text',     width: 14 },
    { label: 'Motivo Atacado',       key: 'motivoPenalizacaoAtacado',  type: 'text',     width: 14 },
    { label: 'Valor Bônus Atacado',  key: 'valorBonusAtacado',         type: 'currency', width: 16 },
    { label: 'Crit. Satisfação',     key: 'critSatisfacao',            type: 'number',   width: 13 },
    { label: 'Dir. Bônus Satisf.',   key: 'direitoBonusSatisfacao',    type: 'text',     width: 14 },
    { label: 'Motivo Satisf.',       key: 'motivoPenalizacaoSatisfacao', type: 'text',   width: 14 },
    { label: 'Valor Bônus Satisf.',  key: 'valorBonusSatisfacao',      type: 'currency', width: 16 },
    { label: 'Data Fat.',            key: 'dataFaturamentoAtacado',    type: 'date',     width: 12 },
    { label: 'Data Venda',           key: 'dataVendaVarejo',           type: 'date',     width: 12 },
    { label: 'Data Empl.',           key: 'dataEmplacamento',          type: 'date',     width: 12 },
    { label: 'Cidade/Estado',        key: 'cidadeEstado',              type: 'text',     width: 20 },
  ] as const;

  ws.columns = COLS.map(c => ({ width: c.width }));

  const BRL_FMT = '"R$"\ #,##0.00';
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const today = new Date().toLocaleDateString('pt-BR');

  // Linha de título
  const titleRow = ws.addRow([`Arquivo PIV — ${mes} — ${today}`]);
  ws.mergeCells(1, 1, 1, COLS.length);
  titleRow.height = 28;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Linha de cabeçalho
  const headerRow = ws.addRow(COLS.map(c => c.label));
  headerRow.height = 34;
  headerRow.eachCell((cell, ci) => {
    const col = COLS[ci - 1];
    const isAtacado  = ci >= 5 && ci <= 8;
    const isSatisf   = ci >= 9 && ci <= 12;
    const fgColor = isAtacado ? 'FF3730A3' : isSatisf ? 'FF5B21B6' : 'FF334155';
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: col.type === 'currency' ? 'right' : 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLS.length } };

  // Linhas de dados
  data.rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF5F3FF';
    const values = COLS.map(col => {
      const v = String((row as unknown as Record<string, unknown>)[col.key] ?? '');
      if (col.type === 'currency') return parseCurrency(v) || null;
      if (col.type === 'number')   return parseFloat(v) || null;
      if (col.type === 'date' && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        const [d, m, y] = v.split('/');
        return new Date(+y, +m - 1, +d);
      }
      return v || '';
    });
    const dr = ws.addRow(values);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const col = COLS[ci - 1];
      const isAtacado = ci >= 5 && ci <= 8;
      const isSatisf  = ci >= 9 && ci <= 12;
      const bgFg = isAtacado ? 'FFEEF2FF' : isSatisf ? 'FFF5F3FF' : bg;
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgFg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (!col) return;
      if (col.type === 'currency') {
        cell.numFmt    = BRL_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font      = { size: 9.5, name: 'Courier New' };
      } else if (col.type === 'date') {
        if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font      = { size: 9.5 };
      } else if (col.type === 'number') {
        cell.numFmt    = '0.00';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font      = { size: 9.5 };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font      = { size: 9.5 };
      }
    });
  });

  // Linha de total
  const totalAtacado = data.rows.reduce((s, r) => s + parseCurrency(r.valorBonusAtacado), 0);
  const totalSatisf  = data.rows.reduce((s, r) => s + parseCurrency(r.valorBonusSatisfacao), 0);
  const totalRow = ws.addRow([
    '', '', `${data.rows.length} veículos`, '',
    '', '', '', totalAtacado || null,
    '', '', '', totalSatisf  || null,
    '', '', '', '',
  ]);
  totalRow.height = 20;
  totalRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { top: { style: 'medium', color: { argb: 'FF94A3B8' } } };
    cell.font   = { bold: true, size: 9.5 };
    if (ci === 8 || ci === 12) {
      cell.numFmt    = BRL_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font      = { bold: true, size: 9.5, name: 'Courier New', color: { argb: ci === 8 ? 'FF3730A3' : 'FF5B21B6' } };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const safeMes = mes.replace(/[/\\]/g, '-');
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `ArquivoPIV_${safeMes}.xlsx`,
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props { filterYear: number; filterMonth: number | null; }

export function ArquivoPIVDashboard({ filterYear, filterMonth }: Props) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const [data, setData]           = useState<ArquivoPivData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [resumoExp, setResumoExp]   = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [showDebug, setShowDebug]   = useState(false);
  const [exporting, setExporting]   = useState(false);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try { await exportToExcel(data); }
    catch (err) { console.error(err); toast.error('Erro ao gerar Excel.'); }
    finally { setExporting(false); }
  };

  const pk = periodoKey(filterYear, filterMonth);

  useEffect(() => {
    setLoading(true);
    setData(null);
    loadArquivoPivData(pk).then(d => { setData(d); setLoading(false); });
  }, [pk]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('Selecione um arquivo PDF válido.'); return; }

    setImporting(true);
    setImportMsg('Iniciando...');
    try {
      const { data: parsed, debugLines: dl } = await parseArquivoPIV(file, msg => setImportMsg(msg));
      setDebugLines(dl);
      // Salva sob o período selecionado no filtro
      const toSave: ArquivoPivData = { ...parsed, periodoKey: pk };
      await saveArquivoPivData(pk, toSave);
      setData(toSave);
      if (parsed.rows.length === 0) {
        toast.warning('PDF importado, mas nenhuma linha de chassi foi detectada. Verifique o painel de debug.');
        setShowDebug(true);
      } else {
        toast.success(`${parsed.rows.length} registros importados com sucesso!`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
      setImportMsg('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const totals = useMemo(() => {
    if (!data) return { atacado: 0, sat: 0, total: 0 };
    let atacado = 0, sat = 0;
    for (const r of data.rows) { atacado += parseCurrency(r.valorBonusAtacado); sat += parseCurrency(r.valorBonusSatisfacao); }
    return { atacado, sat, total: atacado + sat };
  }, [data]);

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Barra de importação */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          size="sm"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? (importMsg || 'Processando...') : (data ? 'Reimportar PDF' : 'Importar PDF PIV')}
        </Button>
        {debugLines.length > 0 && (
          <button
            onClick={() => setShowDebug(v => !v)}
            className="ml-2 text-xs text-amber-600 hover:text-amber-700 underline"
          >
            {showDebug ? 'Ocultar debug' : 'Ver texto extraído'}
          </button>
        )}
        {data && !importing && (
          <Button
            onClick={handleExport}
            disabled={exporting}
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Gerando...' : 'Exportar Excel'}
          </Button>
        )}
        {data && !importing && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="font-medium text-slate-700 max-w-xs truncate">{data.fileName}</span>
            <span className="text-slate-300">·</span>
            <span>Importado em {new Date(data.importedAt).toLocaleDateString('pt-BR')}</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-blue-600">{data.rows.length} registros</span>
          </div>
        )}
        {importing && (
          <span className="text-xs text-slate-500 animate-pulse">{importMsg}</span>
        )}
      </div>

      {/* Painel de debug */}
      {showDebug && debugLines.length > 0 && (
        <div className="bg-slate-900 text-green-300 text-[10px] font-mono px-4 py-3 flex-shrink-0 max-h-72 overflow-y-auto border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-[9px] uppercase tracking-wide">Texto extraído do PDF — {debugLines.length} linhas</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(debugLines.join('\n'));
                toast.success('Texto copiado para a área de transferência!');
              }}
              className="text-[9px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded"
            >
              Copiar tudo
            </button>
          </div>
          {debugLines.map((l, i) => <div key={i} className="hover:bg-slate-800 px-1 rounded">{l}</div>)}
        </div>
      )}

      {/* Estado vazio */}
      {!data && !importing && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
          <FileText className="w-12 h-12" />
          <p className="text-sm">Nenhum extrato PIV importado para este período.</p>
          <p className="text-xs text-slate-400">Use o botão "Importar PDF PIV" para carregar o extrato da Montadora.</p>
        </div>
      )}

      {/* Conteúdo */}
      {data && (
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-full px-6 py-5 flex flex-col gap-5">

            {/* Cards de cabeçalho */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Resumo do Extrato</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mês Apurado</p>
                  <p className="text-2xl font-black text-slate-900">{data.header.mesApurado || '—'}</p>
                  {data.header.dataEmissao && (
                    <p className="text-[10px] text-slate-400 mt-1">Emissão: {data.header.dataEmissao} {data.header.horaEmissao}</p>
                  )}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Total do Crédito</p>
                  <p className="text-xl font-black text-blue-900 tabular-nums">{fmtCurrencyStr(data.header.valorCredito)}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
                    Critério Atacado {data.resumo.criterioAtacadoPct && `(${data.resumo.criterioAtacadoPct})`}
                  </p>
                  <p className="text-xl font-black text-indigo-900 tabular-nums">{fmtCurrencyStr(data.header.creditoAtacado)}</p>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">
                    Critério Satisfação {data.resumo.criterioSatisfacaoPct && `(${data.resumo.criterioSatisfacaoPct})`}
                  </p>
                  <p className="text-xl font-black text-violet-900 tabular-nums">{fmtCurrencyStr(data.header.creditoSatisfacao)}</p>
                </div>
              </div>
              {(data.header.dn || data.header.cnpj) && (
                <div className="bg-slate-100 rounded-lg px-4 py-2 flex items-center gap-6 text-xs text-slate-500">
                  {data.header.dn && <span>{data.header.dn}</span>}
                  {data.header.cnpj && <><span className="text-slate-300">·</span><span>CNPJ: {data.header.cnpj}</span></>}
                </div>
              )}
            </div>

            {/* Critério de Satisfação */}
            {data.criterioSat.periodo && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-700">Critério de Satisfação</p>
                </div>
                <div className="px-5 py-3 flex items-start gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Período</p>
                    <p className="text-sm font-semibold text-slate-800">{data.criterioSat.periodo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nota DN</p>
                    <p className="text-sm font-semibold text-slate-800">{data.criterioSat.notaDN || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nota REG</p>
                    <p className="text-sm font-semibold text-slate-800">{data.criterioSat.notaReg || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Bonif.</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      data.criterioSat.bonif === 'S' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {data.criterioSat.bonif === 'S' ? 'Sim' : (data.criterioSat.bonif || '—')}
                    </span>
                  </div>
                  {data.criterioSat.motivo && (
                    <p className="text-[11px] text-slate-400 self-end">Motivo: {data.criterioSat.motivo}</p>
                  )}
                </div>
              </div>
            )}

            {/* Resumo de Critérios — colapsável */}
            {(data.resumo.motivosAtacado.length > 0 || data.resumo.motivosSatisfacao.length > 0) && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setResumoExp(v => !v)}
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs font-bold text-slate-700">Motivos de Não Direito ao Bônus</span>
                  {resumoExp ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {resumoExp && (
                  <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">
                        Critério Atacado {data.resumo.criterioAtacadoPct && `(${data.resumo.criterioAtacadoPct})`}
                      </p>
                      {data.resumo.motivosAtacado.length === 0
                        ? <p className="text-xs text-slate-400">Nenhum motivo listado.</p>
                        : <ul className="space-y-1">{data.resumo.motivosAtacado.map((m, i) => <li key={i} className="text-xs text-slate-600">{m}</li>)}</ul>
                      }
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-2">
                        Critério Satisfação {data.resumo.criterioSatisfacaoPct && `(${data.resumo.criterioSatisfacaoPct})`}
                      </p>
                      {data.resumo.motivosSatisfacao.length === 0
                        ? <p className="text-xs text-slate-400">Nenhum motivo listado.</p>
                        : <ul className="space-y-1">{data.resumo.motivosSatisfacao.map((m, i) => <li key={i} className="text-xs text-slate-600">{m}</li>)}</ul>
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Totais */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Total Bônus Atacado</p>
                <p className="text-lg font-black text-indigo-900 tabular-nums">{fmtBRL(totals.atacado)}</p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">Total Bônus Satisfação</p>
                <p className="text-lg font-black text-violet-900 tabular-nums">{fmtBRL(totals.sat)}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Geral — {data.rows.length} veículos</p>
                <p className="text-lg font-black text-white tabular-nums">{fmtBRL(totals.total)}</p>
              </div>
            </div>

            {/* Tabela detalhada */}
            {data.rows.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-700">
                    Detalhamento Chassi a Chassi — BASE RENAVAM
                    <span className="ml-2 text-[10px] font-normal text-slate-400">({data.rows.length} registros)</span>
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="border-collapse text-[11px]" style={{ minWidth: 1700 }}>
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap w-10">Mês</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Chassi</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Model Group</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Preço Público</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-indigo-900">Crit. Atacado</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-indigo-900">Dir. Bônus</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-indigo-900">Motivo</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-indigo-900">Valor Bônus</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-violet-900">Crit. Satisf.</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-violet-900">Dir. Bônus</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-violet-900">Motivo</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap bg-violet-900">Valor Bônus</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Data Fat.</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Data Venda</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Data Empl.</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">Cidade/Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.rows.map((row, i) => (
                        <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="px-3 py-2 text-center text-slate-500 font-mono">{row.mes}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 text-[10px] whitespace-nowrap">{row.chassi}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.modelGroup}</td>
                          <td className="px-3 py-2 text-right text-slate-700 tabular-nums font-medium whitespace-nowrap">{fmtCurrencyStr(row.precoPublico)}</td>
                          <td className="px-3 py-2 text-center text-slate-500 bg-indigo-50/40">{row.critAtacado || '—'}</td>
                          <td className="px-3 py-2 text-center bg-indigo-50/40">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              /sim/i.test(row.direitoBonusAtacado) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}>{row.direitoBonusAtacado || '—'}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-slate-500 bg-indigo-50/40">{row.motivoPenalizacaoAtacado || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-indigo-700 tabular-nums whitespace-nowrap bg-indigo-50/40">{fmtCurrencyStr(row.valorBonusAtacado)}</td>
                          <td className="px-3 py-2 text-center text-slate-500 bg-violet-50/40">{row.critSatisfacao || '—'}</td>
                          <td className="px-3 py-2 text-center bg-violet-50/40">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              /sim/i.test(row.direitoBonusSatisfacao) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}>{row.direitoBonusSatisfacao || '—'}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-slate-500 bg-violet-50/40">{row.motivoPenalizacaoSatisfacao || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-violet-700 tabular-nums whitespace-nowrap bg-violet-50/40">{fmtCurrencyStr(row.valorBonusSatisfacao)}</td>
                          <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{row.dataFaturamentoAtacado || '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{row.dataVendaVarejo || '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{row.dataEmplacamento || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.cidadeEstado || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td colSpan={3} className="px-3 py-2.5 text-[10px] font-bold uppercase text-slate-500">Total</td>
                        <td />
                        <td colSpan={3} className="bg-indigo-50/40" />
                        <td className="px-3 py-2.5 text-right font-black text-indigo-800 tabular-nums whitespace-nowrap bg-indigo-50/40">{fmtBRL(totals.atacado)}</td>
                        <td colSpan={3} className="bg-violet-50/40" />
                        <td className="px-3 py-2.5 text-right font-black text-violet-800 tabular-nums whitespace-nowrap bg-violet-50/40">{fmtBRL(totals.sat)}</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
