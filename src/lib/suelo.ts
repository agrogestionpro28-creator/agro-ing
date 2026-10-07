// Interpretación de análisis de suelo y cálculo de recomendaciones.
// Funciones puras: las usa la pantalla de Análisis y se pueden reusar en PDF / pedidos.

export type Estado = 'crit' | 'serious' | 'warn' | 'good';
export type Momento = 'presiembra' | 'post_fertilizacion' | 'otro';

export type FertAplicado = { producto: string; kg_ha: number };

export type AnalisisSuelo = {
  id: string;
  lote_id: string;
  laboratorio: string | null;
  fecha_informe: string | null;
  profundidad_cm: string | null;
  momento: Momento | null;
  cultivo: string | null;
  estado_cultivo: string | null;
  fert_aplicado: FertAplicado[] | null;
  mo: number | null; ph: number | null; ce: number | null;
  p_bray: number | null; n_nitratos: number | null; nan: number | null; s_so4: number | null;
  ca: number | null; mg: number | null; k: number | null; na: number | null;
  cic: number | null; sat_bases: number | null;
  zn: number | null; b: number | null; cu: number | null; fe: number | null; mn: number | null;
  observaciones: string | null;
};

export type ParamKey =
  | 'mo' | 'ph' | 'ce' | 'cic' | 'sat_bases' | 'n_nitratos' | 'nan' | 'p_bray' | 's_so4'
  | 'k' | 'ca' | 'mg' | 'na' | 'zn' | 'b' | 'cu' | 'fe' | 'mn';

type Rango = [limiteSuperior: number, nivel: string, estado: Estado];

export type Param = { key: ParamKey; nombre: string; corto: string; unidad: string; grupo: string; rangos: Rango[] | null };

// Rangos de referencia del Laboratorio Molisol (Totoras).
export const PARAMS: Param[] = [
  { key: 'mo', nombre: 'Materia orgánica', corto: 'MO', unidad: '%', grupo: 'Generales', rangos: [[2, 'Bajo', 'serious'], [3, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
  { key: 'ph', nombre: 'pH (1:2,5)', corto: 'pH', unidad: '', grupo: 'Generales', rangos: [[5.5, 'Fuert. ácido', 'crit'], [6, 'Mod. ácido', 'warn'], [6.6, 'Débil. ácido', 'good'], [7.4, 'Neutro', 'good'], [7.9, 'Lig. alcalino', 'warn'], [8.5, 'Mod. alcalino', 'serious'], [Infinity, 'Fuert. alcalino', 'crit']] },
  { key: 'ce', nombre: 'Conductividad', corto: 'CE', unidad: 'µS/cm', grupo: 'Generales', rangos: [[500, 'No salino', 'good'], [1000, 'Ligera salinidad', 'warn'], [2000, 'Alta salinidad', 'serious'], [Infinity, 'Muy salino', 'crit']] },
  { key: 'cic', nombre: 'CIC', corto: 'CIC', unidad: 'meq/100 g', grupo: 'Generales', rangos: [[5, 'Muy baja', 'crit'], [10, 'Baja', 'serious'], [20, 'Media', 'warn'], [Infinity, 'Alta', 'good']] },
  { key: 'sat_bases', nombre: 'Saturación de bases', corto: 'Sat.', unidad: '%', grupo: 'Generales', rangos: null },
  { key: 'n_nitratos', nombre: 'N-nitratos', corto: 'N', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[4.5, 'Muy bajo', 'crit'], [9, 'Bajo', 'serious'], [15, 'Medio', 'warn'], [22, 'Bien provisto', 'good'], [29, 'Alto', 'good'], [Infinity, 'Muy alto', 'good']] },
  { key: 'nan', nombre: 'N anaeróbico (NAN)', corto: 'NAN', unidad: 'ppm', grupo: 'Macronutrientes', rangos: null },
  { key: 'p_bray', nombre: 'Fósforo Bray I', corto: 'P', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[7, 'Muy bajo', 'crit'], [12, 'Bajo', 'serious'], [18, 'Medio', 'warn'], [25, 'Alto', 'good'], [Infinity, 'Muy alto', 'good']] },
  { key: 's_so4', nombre: 'Azufre (S-SO₄)', corto: 'S', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[4, 'Muy bajo', 'crit'], [7, 'Bajo', 'serious'], [12, 'Medio', 'warn'], [18, 'Alto', 'good'], [Infinity, 'Muy alto', 'good']] },
  { key: 'k', nombre: 'Potasio', corto: 'K', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[90, 'Muy bajo', 'crit'], [130, 'Bajo', 'serious'], [170, 'Medio', 'warn'], [200, 'Alto', 'good'], [Infinity, 'Muy alto', 'good']] },
  { key: 'ca', nombre: 'Calcio', corto: 'Ca', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[250, 'Muy bajo', 'crit'], [500, 'Bajo', 'serious'], [2000, 'Medio', 'warn'], [4500, 'Alto', 'good'], [Infinity, 'Muy alto', 'good']] },
  { key: 'mg', nombre: 'Magnesio', corto: 'Mg', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[50, 'Bajo', 'serious'], [100, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
  { key: 'na', nombre: 'Sodio', corto: 'Na', unidad: 'ppm', grupo: 'Macronutrientes', rangos: [[40, 'Muy bajo', 'good'], [80, 'Bajo', 'good'], [120, 'Medio', 'warn'], [160, 'Alto', 'serious'], [Infinity, 'Muy alto', 'crit']] },
  { key: 'zn', nombre: 'Zinc', corto: 'Zn', unidad: 'ppm', grupo: 'Micronutrientes', rangos: [[0.5, 'Bajo', 'serious'], [1, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
  { key: 'b', nombre: 'Boro', corto: 'B', unidad: 'ppm', grupo: 'Micronutrientes', rangos: [[0.5, 'Bajo', 'serious'], [1, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
  { key: 'cu', nombre: 'Cobre', corto: 'Cu', unidad: 'ppm', grupo: 'Micronutrientes', rangos: [[0.5, 'Bajo', 'serious'], [0.8, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
  { key: 'fe', nombre: 'Hierro', corto: 'Fe', unidad: 'ppm', grupo: 'Micronutrientes', rangos: [[5, 'Bajo', 'serious'], [12, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
  { key: 'mn', nombre: 'Manganeso', corto: 'Mn', unidad: 'ppm', grupo: 'Micronutrientes', rangos: [[1.3, 'Bajo', 'serious'], [5, 'Medio', 'warn'], [Infinity, 'Alto', 'good']] },
];
export const PARAM = Object.fromEntries(PARAMS.map(p => [p.key, p])) as Record<ParamKey, Param>;

export function interpretar(key: ParamKey, v: number | null | undefined): { nivel: string; estado: Estado } | null {
  const p = PARAM[key];
  if (!p?.rangos || v == null || isNaN(v)) return null;
  for (const [lim, nivel, estado] of p.rangos) if (v < lim) return { nivel, estado };
  const last = p.rangos[p.rangos.length - 1];
  return { nivel: last[1], estado: last[2] };
}

/** Nutrientes que limitan (estado distinto de good), ordenados por gravedad. */
export function limitantes(a: AnalisisSuelo) {
  const orden: Record<Estado, number> = { crit: 0, serious: 1, warn: 2, good: 3 };
  return (['p_bray', 'n_nitratos', 's_so4', 'zn', 'b', 'mo'] as ParamKey[])
    .map(k => ({ key: k, valor: a[k] as number | null, int: interpretar(k, a[k] as number | null) }))
    .filter(x => x.int && x.int.estado !== 'good')
    .sort((x, y) => orden[x.int!.estado] - orden[y.int!.estado]);
}

// ── Cultivo ───────────────────────────────────────────────
export type CultivoCalc = 'maiz' | 'soja';
export function cultivoCalc(c: string | null | undefined): CultivoCalc | null {
  if (!c) return null;
  const n = c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('maiz')) return 'maiz';
  if (n.includes('soja')) return 'soja';
  return null;
}

/** Umbrales críticos por cultivo (0–20 cm). */
export const UMBRAL: Record<'p_bray' | 's_so4' | 'n_nitratos' | 'zn', Record<CultivoCalc, number>> = {
  p_bray: { maiz: 18, soja: 13 },
  s_so4: { maiz: 10, soja: 10 },
  n_nitratos: { maiz: 15, soja: 15 },
  zn: { maiz: 1, soja: 0.5 },
};

// ── Fertilizantes ─────────────────────────────────────────
// Grado en % de N, P (elemento), S y Zn.
export type Grado = { n: number; p: number; s: number; zn: number };
export const PRODUCTOS: Record<string, Grado> = {
  'MAP 11-52-0': { n: 11, p: 22.7, s: 0, zn: 0 },
  'SPS 0-21-0-12S': { n: 0, p: 9.2, s: 12, zn: 0 },
  'Urea': { n: 46, p: 0, s: 0, zn: 0 },
  'Sulfato de amonio': { n: 21, p: 0, s: 24, zn: 0 },
  'Yeso agrícola': { n: 0, p: 0, s: 18, zn: 0 },
  'Sulfato de zinc': { n: 0, p: 0, s: 0, zn: 35 },
};

/** Lee grados tipo "12-40-0-5-1Zn" (N-P2O5-K2O-S-Zn) o productos conocidos. */
export function gradoDe(producto: string): Grado {
  const conocido = Object.entries(PRODUCTOS).find(([k]) => k.toLowerCase() === producto.toLowerCase().trim());
  if (conocido) return conocido[1];
  const t = producto.toLowerCase();
  if (t.includes('urea')) return PRODUCTOS['Urea'];
  if (t.includes('sulfato de amonio') || t === 'sa') return PRODUCTOS['Sulfato de amonio'];
  if (t.includes('map')) return PRODUCTOS['MAP 11-52-0'];
  if (t.includes('sps') || t.includes('superfosfato')) return PRODUCTOS['SPS 0-21-0-12S'];
  if (t.includes('yeso')) return PRODUCTOS['Yeso agrícola'];
  const nums = producto.match(/\d+(?:[.,]\d+)?/g)?.map(x => parseFloat(x.replace(',', '.'))) ?? [];
  if (nums.length >= 3) {
    return { n: nums[0], p: nums[1] * 0.436, s: nums[3] ?? 0, zn: nums[4] ?? 0 };
  }
  return { n: 0, p: 0, s: 0, zn: 0 };
}

export function aportes(fert: FertAplicado[] | null | undefined) {
  const t = { n: 0, p: 0, s: 0, zn: 0 };
  for (const f of fert ?? []) {
    const g = gradoDe(f.producto);
    t.n += f.kg_ha * g.n / 100; t.p += f.kg_ha * g.p / 100;
    t.s += f.kg_ha * g.s / 100; t.zn += f.kg_ha * g.zn / 100;
  }
  return t;
}

// ── Recomendación ─────────────────────────────────────────
export type Recomendacion = {
  cultivo: CultivoCalc;
  modo: 'siembra' | 'complemento';
  necesidad: { n: number | null; p: number; s: number; zn: number };
  aplicado: { n: number; p: number; s: number; zn: number };
  productos: { producto: string; kg_ha: number; momento: string }[];
  notas: string[];
};

const r5 = (x: number) => Math.round(x / 5) * 5;
const r05 = (x: number) => Math.round(x * 2) / 2;

export type Supuestos = {
  rindeMaiz: number;   // t/ha
  rindeSoja: number;   // t/ha
  nSuelo060?: number | null; // kg N/ha 0–60 cm medido
};

export function recomendar(a: AnalisisSuelo, cultivoLote: string | null, sup: Supuestos): Recomendacion | null {
  const cultivo = cultivoCalc(a.cultivo ?? cultivoLote);
  if (!cultivo) return null;
  const p = a.p_bray ?? 0, s = a.s_so4 ?? 0, zn = a.zn ?? 1, nitr = a.n_nitratos ?? 0;
  const ap = aportes(a.fert_aplicado);
  const postFert = a.momento === 'post_fertilizacion' && (a.fert_aplicado?.length ?? 0) > 0;
  const notas: string[] = [];
  const productos: Recomendacion['productos'] = [];

  if (cultivo === 'maiz') {
    const R = sup.rindeMaiz;
    const pNec = r05(1.7 * R + Math.max(0, 18 - p) * 2.5);
    const sNec = r05(s < 10 ? 12 + (10 - s) * 0.5 : 0);
    const znNec = zn < 0.3 ? 2 : zn < 0.5 ? 1.5 : zn < 1 ? 0.75 : 0;
    // N del suelo: medido, o estimado. Si el muestreo fue post-fertilización el nitrato no sirve.
    let nSuelo: number;
    if (sup.nSuelo060 != null) nSuelo = sup.nSuelo060;
    else if (postFert) {
      // El nitrato post-fertilización no sirve: se supone 35 kg/ha ajustado por el NAN del lote (40 ppm = referencia).
      nSuelo = Math.round(35 * Math.min(1.3, Math.max(0.6, (a.nan ?? 40) / 40)));
      notas.push(`Muestreo post-fertilización: N del suelo 0–60 cm supuesto en ${nSuelo} kg/ha (ajustado por NAN). Cargá un test de nitratos para afinar.`);
    }
    else { nSuelo = nitr * 2.6 * 1.7; notas.push(`N del suelo 0–60 cm estimado en ${Math.round(nSuelo)} kg/ha desde nitratos 0–20 cm.`); }
    const nNec = Math.max(0, Math.round(16 * R - nSuelo));

    if (postFert) {
      const sFalta = Math.max(0, sNec - ap.s);
      const nFalta = Math.max(0, nNec - ap.n);
      const sa = sFalta > 0 ? Math.max(40, r5(sFalta / 0.24)) : 0;
      const urea = r5(Math.max(0, nFalta - sa * 0.21) / 0.46);
      if (sa) productos.push({ producto: 'Sulfato de amonio', kg_ha: sa, momento: 'V4–V5' });
      if (urea >= 20) productos.push({ producto: 'Urea', kg_ha: urea, momento: 'V4–V6, con NBPT o antes de lluvia' });
      const znFol = zn < 0.3 ? 0.5 : zn < 0.5 ? 0.4 : (zn < 1 && ap.zn === 0 ? 0.3 : 0);
      if (znFol) productos.push({ producto: 'Zinc foliar (kg Zn/ha)', kg_ha: znFol, momento: 'V5–V6' });
      const pFalta = pNec - ap.p;
      if (pFalta > 3) notas.push(`Faltaron ~${Math.round(pFalta)} kg P/ha respecto de lo recomendado. No se corrige en este cultivo: reponer en el próximo.`);
      notas.push('Antes de sumar urea: test de nitratos 0–30 cm en V5–V6 o franja con SPAD.');
      return { cultivo, modo: 'complemento', necesidad: { n: nNec, p: pNec, s: sNec, zn: znNec }, aplicado: ap, productos, notas };
    }

    const map = pNec / 0.227, sa = sNec / 0.24;
    const urea = Math.max(0, nNec - map * 0.11 - sa * 0.21) / 0.46;
    productos.push({ producto: 'MAP 11-52-0', kg_ha: r5(map), momento: 'Siembra' });
    if (sa) productos.push({ producto: 'Sulfato de amonio', kg_ha: r5(sa), momento: 'Siembra' });
    if (urea > 0) productos.push({ producto: 'Urea', kg_ha: r5(urea), momento: 'Siembra a V6' });
    if (znNec) productos.push({ producto: 'Sulfato de zinc', kg_ha: Math.max(1, Math.round(znNec / 0.35)), momento: 'Siembra o semilla' });
    return { cultivo, modo: 'siembra', necesidad: { n: nNec, p: pNec, s: sNec, zn: znNec }, aplicado: ap, productos, notas };
  }

  // Soja
  const R = sup.rindeSoja;
  const pNec = r05(3.3 * R + Math.max(0, 13 - p) * 2.5);
  const sNec = r05(s < 10 ? 10 + (10 - s) : 0);
  const pFalta = Math.max(0, pNec - ap.p), sFalta = Math.max(0, sNec - ap.s);
  const sps = r5(pFalta / 0.092);
  if (sps) productos.push({ producto: 'SPS 0-21-0-12S', kg_ha: sps, momento: 'Siembra, al costado de la línea' });
  const sExtra = sFalta - sps * 0.12;
  if (sExtra > 0 || s < 4) productos.push({ producto: 'Yeso agrícola', kg_ha: Math.max(50, r5(Math.max(0, sExtra) / 0.18)), momento: 'Presiembra' });
  productos.push({ producto: 'Inoculante + curasemilla', kg_ha: 0, momento: 'Con la semilla' });
  if ((a.b ?? 1) < 0.7) notas.push('Boro en el límite inferior: evaluar B foliar en R1–R3.');
  return { cultivo, modo: postFert ? 'complemento' : 'siembra', necesidad: { n: null, p: pNec, s: sNec, zn: 0 }, aplicado: ap, productos, notas };
}

export const fmt = (v: number | null | undefined, d = 1) =>
  v == null || isNaN(v) ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtValor(v: number | null | undefined) {
  if (v == null || isNaN(v)) return '—';
  const dec = v >= 100 ? 0 : Math.min(2, (String(v).split('.')[1] ?? '').length);
  return fmt(v, dec);
}
