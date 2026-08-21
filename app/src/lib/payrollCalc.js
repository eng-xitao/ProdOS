/**
 * Cálculo automático de encargos trabalhistas usados em Folha de
 * Pagamento e Rescisão. Substitui a digitação manual de INSS/IRRF
 * e das verbas rescisórias por fórmulas da CLT.
 *
 * IMPORTANTE: as tabelas de INSS e IRRF são reajustadas todo ano por
 * portaria/lei. As tabelas abaixo são as vigentes em 2026:
 *   - INSS: Portaria Interministerial MPS/MF nº 13, de 09/01/2026.
 *   - IRRF: tabela tradicional (sem reajuste desde 2025) + redutor
 *     mensal criado pela Lei nº 15.270/2025 ("Reforma da Renda"),
 *     que isenta rendimentos até R$ 5.000 e reduz o imposto de forma
 *     linear entre R$ 5.000,01 e R$ 7.350,00.
 * Sempre confira com o contador da empresa se essas tabelas ainda
 * são as vigentes antes de usar os valores gerados aqui em folhas
 * e rescisões reais.
 */

export const INSS_TABLE_2026 = [
  { upTo: 1621.0, rate: 0.075 },
  { upTo: 2902.84, rate: 0.09 },
  { upTo: 4354.27, rate: 0.12 },
  { upTo: 8475.55, rate: 0.14 },
];
export const INSS_CEILING_2026 = 8475.55;

export const IRRF_TABLE_2026 = [
  { upTo: 2428.8, rate: 0, deduction: 0 },
  { upTo: 2826.65, rate: 0.075, deduction: 182.16 },
  { upTo: 3751.05, rate: 0.15, deduction: 394.16 },
  { upTo: 4664.68, rate: 0.225, deduction: 675.49 },
  { upTo: Infinity, rate: 0.275, deduction: 908.73 },
];
export const IRRF_DEPENDENT_DEDUCTION_2026 = 189.59;
export const IRRF_ISENCAO_TOTAL_2026 = 5000.0;
export const IRRF_TETO_REDUTOR_2026 = 7350.0;

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Desconto de INSS pela tabela progressiva por faixas (2026), já limitado ao teto. */
export function calculateINSS(grossValue) {
  const base = Math.min(Math.max(grossValue || 0, 0), INSS_CEILING_2026);
  let total = 0;
  let lower = 0;
  for (const bracket of INSS_TABLE_2026) {
    if (base <= lower) break;
    const upper = Math.min(base, bracket.upTo);
    total += (upper - lower) * bracket.rate;
    lower = bracket.upTo;
  }
  return round2(total);
}

/**
 * IRRF sobre o rendimento bruto tributável do mês, já descontando
 * INSS e dependentes e aplicando o redutor da Lei nº 15.270/2025.
 * `grossTaxableIncome` deve ser o valor bruto (antes do INSS).
 */
export function calculateIRRF(grossTaxableIncome, inssAmount, dependentsCount = 0) {
  const gross = Math.max(grossTaxableIncome || 0, 0);

  // Isenção total garantida pela Reforma da Renda pra quem ganha até R$5.000 brutos.
  if (gross <= IRRF_ISENCAO_TOTAL_2026) return 0;

  const base = Math.max(gross - (inssAmount || 0) - (dependentsCount || 0) * IRRF_DEPENDENT_DEDUCTION_2026, 0);
  const bracket = IRRF_TABLE_2026.find((b) => base <= b.upTo);
  const rawTax = Math.max(base * bracket.rate - bracket.deduction, 0);

  let reduction = 0;
  if (gross <= IRRF_TETO_REDUTOR_2026) {
    reduction = Math.max(978.62 - 0.133145 * gross, 0);
  }

  return round2(Math.max(rawTax - reduction, 0));
}

function parseDate(value) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

/** Meses completos trabalhados no ano-calendário até a data de desligamento (regra dos 15 dias da CLT). */
export function monthsWorkedInYear(terminationDate) {
  const d = parseDate(terminationDate);
  if (!d) return 0;
  let months = d.getMonth() + 1;
  if (d.getDate() < 15) months -= 1;
  return Math.max(months, 0);
}

/** Avos de férias proporcionais: meses completos desde o último aniversário de admissão. */
export function vacationAvos(hireDate, terminationDate) {
  const hire = parseDate(hireDate);
  const term = parseDate(terminationDate);
  if (!hire || !term) return 0;

  const anniversary = new Date(term.getFullYear(), hire.getMonth(), hire.getDate());
  if (anniversary > term) anniversary.setFullYear(anniversary.getFullYear() - 1);

  let months = (term.getFullYear() - anniversary.getFullYear()) * 12 + (term.getMonth() - anniversary.getMonth());
  if (term.getDate() - anniversary.getDate() >= 15) months += 1;
  return Math.max(Math.min(months, 12), 0);
}

/** Dias de aviso prévio (30 + 3 por ano completo trabalhado, teto de 90 — Lei 12.506/2011). */
export function avisoPrevioDays(hireDate, terminationDate) {
  const hire = parseDate(hireDate);
  const term = parseDate(terminationDate);
  if (!hire || !term) return 30;
  const fullYears = Math.floor((term - hire) / (365.25 * 24 * 3600 * 1000));
  return Math.min(30 + fullYears * 3, 90);
}

/** Estimativa da multa de 40% do FGTS, assumindo depósito de 8% do salário base durante todo o vínculo. */
export function estimateFgtsFine(baseSalary, hireDate, terminationDate) {
  const hire = parseDate(hireDate);
  const term = parseDate(terminationDate);
  if (!hire || !term) return 0;
  let totalMonths = (term.getFullYear() - hire.getFullYear()) * 12 + (term.getMonth() - hire.getMonth());
  if (term.getDate() >= hire.getDate()) totalMonths += 1;
  totalMonths = Math.max(totalMonths, 0);
  const estimatedFgtsBalance = totalMonths * (baseSalary || 0) * 0.08;
  return round2(estimatedFgtsBalance * 0.4);
}

/**
 * Calcula automaticamente todas as verbas de uma rescisão, incluindo
 * o INSS/IRRF retidos sobre a parcela tributável (saldo de salário +
 * 13º proporcional). Férias, 1/3 constitucional, aviso prévio
 * indenizado e multa do FGTS são isentos de INSS/IRRF.
 */
export function calculateTermination({ baseSalary, hireDate, terminationDate, noticeType, dependentsCount = 0 }) {
  const salary = Number(baseSalary || 0);
  const term = parseDate(terminationDate);
  const dayOfMonth = term ? term.getDate() : 0;

  const balanceSalary = round2((salary / 30) * dayOfMonth);

  const vAvos = vacationAvos(hireDate, terminationDate);
  const proportionalVacation = round2((salary / 12) * vAvos * (4 / 3)); // já com 1/3 constitucional

  const avos13 = monthsWorkedInYear(terminationDate);
  const proportional13th = round2((salary / 12) * avos13);

  const noticeDays = avisoPrevioDays(hireDate, terminationDate);
  const noticeAmount = noticeType === "indenizado" || noticeType === "dispensado" ? round2((salary / 30) * noticeDays) : 0;

  const fgtsFine = estimateFgtsFine(salary, hireDate, terminationDate);

  // INSS/IRRF incidem só sobre saldo de salário + 13º proporcional (parcelas tributáveis).
  const taxableBase = balanceSalary + proportional13th;
  const inssOnTaxable = calculateINSS(taxableBase);
  const irrfOnTaxable = calculateIRRF(taxableBase, inssOnTaxable, dependentsCount);

  const grossTotal = round2(balanceSalary + proportionalVacation + proportional13th + noticeAmount + fgtsFine);
  const totalAmount = round2(grossTotal - inssOnTaxable - irrfOnTaxable);

  return {
    balanceSalary,
    proportionalVacation,
    proportional13th,
    noticeAmount,
    noticeDays,
    fgtsFine,
    inssOnTaxable,
    irrfOnTaxable,
    grossTotal,
    totalAmount,
    vacationAvos: vAvos,
    thirteenthAvos: avos13,
  };
}
