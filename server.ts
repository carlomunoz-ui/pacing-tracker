import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Normalize spreadsheet headers mapping
const HEADER_KEY_MAP: Record<string, string> = {
  'opp id': 'oppId',
  'opp name': 'oppName',
  'oc': 'oc',
  'agencia': 'agencia',
  'cliente': 'cliente',
  'motivo': 'motivo',
  'tipo compra': 'tipoCompra',
  'formato': 'formato',
  'inversión': 'inversionRaw',
  'inversión ': 'inversionRaw',
  'cpm': 'cpmRaw',
  'obj': 'objectiveRaw',
  ' obj': 'objectiveRaw',
  'fecha inicio': 'fechaInicio',
  'fecha de inicio': 'fechaInicio',
  'fecha fin': 'fechaFin',
  'fecha de fin': 'fechaFin',
  'mes': 'mes',
  'avance': 'avanceRaw',
  'avance ': 'avanceRaw',
  'pacing': 'pacingRaw',
};

// Fallback hardcoded campaigns based on exact spreadsheet contents
const DEFAULT_CAMPAIGNS = [
  {
    oppId: "OP-116460",
    oppName: "PE_PE_Branding_Havas_NATURA_CTV_CPM_Febrero_Marzo_Abril26_OTT_116460",
    oc: "0023/002",
    agencia: "Havas",
    cliente: "NATURA",
    motivo: "Chronos",
    tipoCompra: "CPM",
    formato: "CTV",
    inversionRaw: "$4.336",
    inversionValue: 4336,
    currency: "USD",
    cpmRaw: "$8,40",
    cpmValue: 8.4,
    objectiveRaw: "516.161",
    objectiveValue: 516161,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "525.981",
    avanceValue: 525981,
    pacingRaw: "101,90%",
    pacingValue: 101.9
  },
  {
    oppId: "OP-117556",
    oppName: "PE_PE_Branding_Havas_Natura_Chronos_VideoAVA_CPM_Marzo_Abril26_117556",
    oc: "0012/000",
    agencia: "Havas",
    cliente: "NATURA",
    motivo: "Chronos",
    tipoCompra: "CPM",
    formato: "VideoAVA",
    inversionRaw: "$2.535",
    inversionValue: 2535,
    currency: "USD",
    cpmRaw: "$10,00",
    cpmValue: 10.0,
    objectiveRaw: "253.521",
    objectiveValue: 253521,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "259.694",
    avanceValue: 259694,
    pacingRaw: "102,43%",
    pacingValue: 102.43
  },
  {
    oppId: "OP-116307",
    oppName: "PE_PE_Performance_Havas_Natura_Chronos_DCO_CPM_Marzo_Abril26_116307",
    oc: "0014/000",
    agencia: "Havas",
    cliente: "NATURA",
    motivo: "Chronos",
    tipoCompra: "CPC",
    formato: "DCO",
    inversionRaw: "$3.944",
    inversionValue: 3944,
    currency: "USD",
    cpmRaw: "$0,40",
    cpmValue: 0.4,
    objectiveRaw: "9.859",
    objectiveValue: 9859,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "14.850",
    avanceValue: 14850,
    pacingRaw: "150,62%",
    pacingValue: 150.62
  },
  {
    oppId: "OP-118378",
    oppName: "PE_PE_Performance_Havas_CLARO_Portabilidad_BannersSTD_CPC_Abril26_118378",
    oc: "0305/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "Portabilidad",
    tipoCompra: "CPC",
    formato: "BannersSTD",
    inversionRaw: "$6.000",
    inversionValue: 6000,
    currency: "USD",
    cpmRaw: "$0,40",
    cpmValue: 0.4,
    objectiveRaw: "15.000",
    objectiveValue: 15000,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "15.441",
    avanceValue: 15441,
    pacingRaw: "102,94%",
    pacingValue: 102.94
  },
  {
    oppId: "OP-118379",
    oppName: "PE_OTT_LG_CLARO_TiendaVirtual_HazloTuyo_CarouselCompanion_Abril26_118379",
    oc: "0304/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "HazloTuyo",
    tipoCompra: "CPM",
    formato: "CarouselCompanion",
    inversionRaw: "$8.000",
    inversionValue: 8000,
    currency: "USD",
    cpmRaw: "$11,00",
    cpmValue: 11.0,
    objectiveRaw: "727.273",
    objectiveValue: 727273,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "734.203",
    avanceValue: 734203,
    pacingRaw: "100,95%",
    pacingValue: 100.95
  },
  {
    oppId: "OP-118760",
    oppName: "PE_PE_Performance_Havas_Claro_Postpago_AltoValor_TaptoWSP_CPC_Abril26_118760",
    oc: "0506/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "Postpago",
    tipoCompra: "CPC",
    formato: "TaptoWSP",
    inversionRaw: "$8.000",
    inversionValue: 8000,
    currency: "USD",
    cpmRaw: "$0,40",
    cpmValue: 0.4,
    objectiveRaw: "20.000",
    objectiveValue: 20000,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "20.977",
    avanceValue: 20977,
    pacingRaw: "104,89%",
    pacingValue: 104.89
  },
  {
    oppId: "OP-119107",
    oppName: "PE_OTT_LG_CLARO_TiendaVirtual_CyberWow_CarouselCompanion_Abril26_119107",
    oc: "0752/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "CyberWow",
    tipoCompra: "CPM",
    formato: "CarouselCompanion",
    inversionRaw: "$7.700",
    inversionValue: 7700,
    currency: "USD",
    cpmRaw: "$11,00",
    cpmValue: 11.0,
    objectiveRaw: "700.000",
    objectiveValue: 700000,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "710.748",
    avanceValue: 710748,
    pacingRaw: "101,54%",
    pacingValue: 101.54
  },
  {
    oppId: "OP-119021",
    oppName: "PE_PE_Branding_Havas_CLARO_CYBER_SUNSTORIEE_CPM_Abril26_119021",
    oc: "0753/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "CYBER",
    tipoCompra: "CPM",
    formato: "SUNSTORIE",
    inversionRaw: "$7.000",
    inversionValue: 7000,
    currency: "USD",
    cpmRaw: "$6,33",
    cpmValue: 6.33,
    objectiveRaw: "1.105.845",
    objectiveValue: 1105845,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "1.109.876",
    avanceValue: 1109876,
    pacingRaw: "100,36%",
    pacingValue: 100.36
  },
  {
    oppId: "OP-117000",
    oppName: "PE_OTT_LG_GrupMDeal(PE)_La Positiva_CampañaVidaI_LG_CPM_Marzo_Abril26_117000",
    oc: "2026003657 / 2026002958",
    agencia: "GroupM",
    cliente: "La Positiva",
    motivo: "CampañaVidaI",
    tipoCompra: "CPM",
    formato: "LG",
    inversionRaw: "S/.2.571",
    inversionValue: 2571,
    currency: "PEN",
    cpmRaw: "$20,16",
    cpmValue: 20.16,
    objectiveRaw: "127.514",
    objectiveValue: 127514,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "138.338",
    avanceValue: 138338,
    pacingRaw: "108,49%",
    pacingValue: 108.49
  },
  {
    oppId: "OP-118032",
    oppName: "PE_PE_Branding_GroupM_UIP_SuperMarioGalaxy_SkinVideo_CPM_Marzo_Abril26_118032",
    oc: "2026003503",
    agencia: "GroupM",
    cliente: "UIP",
    motivo: "SuperMarioGalaxy",
    tipoCompra: "CPM",
    formato: "SkinVideo",
    inversionRaw: "S/.1.895",
    inversionValue: 1895,
    currency: "PEN",
    cpmRaw: "$33,26",
    cpmValue: 33.26,
    objectiveRaw: "56.968",
    objectiveValue: 56968,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "62.267",
    avanceValue: 62267,
    pacingRaw: "109,30%",
    pacingValue: 109.30
  },
  {
    oppId: "OP-118263",
    oppName: "PE_OTT_LG_GroupM_Founding_BBVA_Mundial_Lg_CPM_Abril_Mayo26_118263",
    oc: "2026003742",
    agencia: "GroupM",
    cliente: "BBVA",
    motivo: "Mundial",
    tipoCompra: "CPM",
    formato: "Lg",
    inversionRaw: "S/.30.543",
    inversionValue: 30543,
    currency: "PEN",
    cpmRaw: "$26,52",
    cpmValue: 26.52,
    objectiveRaw: "1.151.703",
    objectiveValue: 1151703,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "1.151.702",
    avanceValue: 1151702,
    pacingRaw: "100,00%",
    pacingValue: 100.00
  },
  {
    oppId: "OP-118638",
    oppName: "PE_PE_Branding_GroupM_Skechers_CozyFit_SUNSTORIE_CPV_ABRIL26_118638",
    oc: "202600407",
    agencia: "GroupM",
    cliente: "Skechers",
    motivo: "CozyFit",
    tipoCompra: "CPV",
    formato: "SUNSTORIE",
    inversionRaw: "S/.709",
    inversionValue: 709,
    currency: "PEN",
    cpmRaw: "$0,02",
    cpmValue: 0.02,
    objectiveRaw: "30.062",
    objectiveValue: 30062,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "49.882",
    avanceValue: 49882,
    pacingRaw: "165,93%",
    pacingValue: 165.93
  },
  {
    oppId: "OP-118969",
    oppName: "PE_PE_Branding_GroupM_Tambo_Madrugadoras_Social_CPM_Abril26_118969",
    oc: "",
    agencia: "GroupM",
    cliente: "Tambo",
    motivo: "Madrugadoras",
    tipoCompra: "CPM",
    formato: "Social",
    inversionRaw: "S/.636",
    inversionValue: 636,
    currency: "PEN",
    cpmRaw: "$10,56",
    cpmValue: 10.56,
    objectiveRaw: "60.256",
    objectiveValue: 60256,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "62.616",
    avanceValue: 62616,
    pacingRaw: "103,92%",
    pacingValue: 103.92
  },
  {
    oppId: "OP-119715",
    oppName: "PE_PE_Performance_Havas_CLARO_Portabilidad_BannersSTD_CPC_Mayo26_119715",
    oc: "0526/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "Portabilidad",
    tipoCompra: "CPC",
    formato: "BannersSTD",
    inversionRaw: "$6.000",
    inversionValue: 6000,
    currency: "USD",
    cpmRaw: "$0,40",
    cpmValue: 0.4,
    objectiveRaw: "15.000",
    objectiveValue: 15000,
    fechaInicio: "04/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "13.800",
    avanceValue: 13800,
    pacingRaw: "92,00%",
    pacingValue: 92.00
  },
  {
    oppId: "OP-119721",
    oppName: "PE_OTT_LG_CLARO_TiendaVirtual_HazloTuyo_CarouselCompanion_Mayo26_119721",
    oc: "0525/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "HazloTuyo",
    tipoCompra: "CPM",
    formato: "CarouselCompanion",
    inversionRaw: "$8.000",
    inversionValue: 8000,
    currency: "USD",
    cpmRaw: "$11,00",
    cpmValue: 11.0,
    objectiveRaw: "727.273",
    objectiveValue: 727273,
    fechaInicio: "07/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "537.082",
    avanceValue: 537082,
    pacingRaw: "73,85%",
    pacingValue: 73.85
  },
  {
    oppId: "OP-118263",
    oppName: "PE_OTT_LG_GroupM_Founding_BBVA_Mundial_LG_CPM_Abril_Mayo26_118263",
    oc: "2026003742",
    agencia: "Havas",
    cliente: "BBVA",
    motivo: "Mundial",
    tipoCompra: "CPM",
    formato: "LG",
    inversionRaw: "S/.2.956",
    inversionValue: 2956,
    currency: "PEN",
    cpmRaw: "S/.26,50",
    cpmValue: 26.50,
    objectiveRaw: "111.539",
    objectiveValue: 111539,
    fechaInicio: "01/05/2026",
    fechaFin: "08/05/2026",
    mes: "mayo",
    avanceRaw: "112.987",
    avanceValue: 112987,
    pacingRaw: "101,30%",
    pacingValue: 101.30
  },
  {
    oppId: "OP-119716",
    oppName: "PE_PE_Branding_GroupM_Skechers_CozyFitWomen_Moomy&Me_Sunstories_CPV_Mayo26_119716",
    oc: "2026005143",
    agencia: "GroupM",
    cliente: "Skechers",
    motivo: "CozyFitWomen",
    tipoCompra: "CPV",
    formato: "Sunstories",
    inversionRaw: "S/.709",
    inversionValue: 709,
    currency: "PEN",
    cpmRaw: "S/.0,02",
    cpmValue: 0.02,
    objectiveRaw: "30.190",
    objectiveValue: 30190,
    fechaInicio: "07/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "52.553",
    avanceValue: 52553,
    pacingRaw: "174,08%",
    pacingValue: 174.08
  },
  {
    oppId: "OP-120374",
    oppName: "PE_PE_Performance_Havas_Claro_Postpago_AltoValor_TaptoWSP_CPC_Mayo_120374",
    oc: "1028/000",
    agencia: "Havas",
    cliente: "CLARO",
    motivo: "Postpago",
    tipoCompra: "CPC",
    formato: "TaptoWSP",
    inversionRaw: "$8.000",
    inversionValue: 8000,
    currency: "USD",
    cpmRaw: "$0,40",
    cpmValue: 0.4,
    objectiveRaw: "20.000",
    objectiveValue: 20000,
    fechaInicio: "15/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "22.329",
    avanceValue: 22329,
    pacingRaw: "111,65%",
    pacingValue: 111.65
  },
  {
    oppId: "OP-120427",
    oppName: "PE_PE_Branding_GroupM_Tambo_Madrugadoras_Social_CPM_Mayo26_120427",
    oc: "2026005607",
    agencia: "GroupM",
    cliente: "Tambo",
    motivo: "Madrugadoras",
    tipoCompra: "CPM",
    formato: "Social",
    inversionRaw: "S/.1.895",
    inversionValue: 1895,
    currency: "PEN",
    cpmRaw: "S/.15,80",
    cpmValue: 15.80,
    objectiveRaw: "119.917",
    objectiveValue: 119917,
    fechaInicio: "20/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "21.602",
    avanceValue: 21602,
    pacingRaw: "18,01%",
    pacingValue: 18.01
  }
];

// Numeric cleaners for parser
function cleanNumber(val: string): number {
  if (!val) return 0;
  let cleaned = val.replace(/%/g, '').replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;
  // Convert thousands dots to nothing, and decimal commas to standard dots.
  cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCsvContent(csvText: string) {
  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return [];

  const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  const normalizedHeaders = rawHeaders.map(h => {
    const lower = h.toLowerCase();
    return HEADER_KEY_MAP[lower] || lower;
  });

  const campaignsList: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < normalizedHeaders.length) continue;

    const rowObj: Record<string, string> = {};
    normalizedHeaders.forEach((key, index) => {
      if (key) {
        rowObj[key] = cells[index] || "";
      }
    });

    // We make sure OPP ID is not empty before processing
    if (!rowObj.oppId && !rowObj.oppName) continue;

    const appName = rowObj.oppName || "";
    const isPen = rowObj.inversionRaw?.includes("S/.") || rowObj.cpmRaw?.includes("S/.") || appName.toUpperCase().includes("S/.");
    const currency = isPen ? "PEN" : "USD";

    const inversionVal = cleanNumber(rowObj.inversionRaw || "");
    const cpmVal = cleanNumber(rowObj.cpmRaw || "");
    const objectiveVal = cleanNumber(rowObj.objectiveRaw || "");
    const avanceVal = cleanNumber(rowObj.avanceRaw || "");
    const pacingVal = cleanNumber(rowObj.pacingRaw || "");

    campaignsList.push({
      oppId: rowObj.oppId || `OP-${Math.floor(100000 + Math.random() * 900000)}`,
      oppName: appName,
      oc: rowObj.oc || "",
      agencia: rowObj.agencia || "Desconocido",
      cliente: rowObj.cliente || "Desconocido",
      motivo: rowObj.motivo || "",
      tipoCompra: rowObj.tipoCompra || "CPM",
      formato: rowObj.formato || "Otro",
      inversionRaw: rowObj.inversionRaw || `${isPen ? 'S/.' : '$'}${inversionVal}`,
      inversionValue: inversionVal,
      currency,
      cpmRaw: rowObj.cpmRaw || `${isPen ? 'S/.' : '$'}${cpmVal}`,
      cpmValue: cpmVal,
      objectiveRaw: rowObj.objectiveRaw || String(objectiveVal),
      objectiveValue: objectiveVal,
      fechaInicio: rowObj.fechaInicio || "",
      fechaFin: rowObj.fechaFin || "",
      mes: rowObj.mes || "abril",
      avanceRaw: rowObj.avanceRaw || String(avanceVal),
      avanceValue: avanceVal,
      pacingRaw: rowObj.pacingRaw || `${pacingVal.toFixed(2)}%`,
      pacingValue: pacingVal,
    });
  }

  return campaignsList;
}

// Fallback fallback datasets for specific tabs
const DEFAULT_CYN_CAMPAIGNS = [
  {
    oppId: "OP-201011",
    oppName: "PE_PE_Branding_CYN_Natura_EKOS_Video_Abril26_201011",
    oc: "5501/010",
    agencia: "CYN",
    cliente: "NATURA",
    motivo: "Ekos",
    tipoCompra: "CPM",
    formato: "Video",
    inversionRaw: "S/.10.500",
    inversionValue: 10500,
    currency: "PEN",
    cpmRaw: "S/.12,00",
    cpmValue: 12.0,
    objectiveRaw: "875.000",
    objectiveValue: 875000,
    fechaInicio: "01/04/2026",
    fechaFin: "23/04/2026",
    mes: "abril",
    avanceRaw: "882.100",
    avanceValue: 882100,
    pacingRaw: "100,81%",
    pacingValue: 100.81
  },
  {
    oppId: "OP-201012",
    oppName: "PE_PE_Performance_CYN_Claro_Hogar_CPC_Mayo26_201012",
    oc: "4410/022",
    agencia: "CYN",
    cliente: "CLARO",
    motivo: "Hogar",
    tipoCompra: "CPC",
    formato: "BannersSTD",
    inversionRaw: "$6.500",
    inversionValue: 6500,
    currency: "USD",
    cpmRaw: "$0,35",
    cpmValue: 0.35,
    objectiveRaw: "18.571",
    objectiveValue: 18571,
    fechaInicio: "01/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "14.200",
    avanceValue: 14200,
    pacingRaw: "76,46%",
    pacingValue: 76.46
  },
  {
    oppId: "OP-201013",
    oppName: "PE_PE_Branding_CYN_Alicorp_Bolivar_Sunstory_Mayo26_201013",
    oc: "3302/100",
    agencia: "CYN",
    cliente: "ALICORP",
    motivo: "Bolivar",
    tipoCompra: "CPM",
    formato: "Sunstories",
    inversionRaw: "S/.8.000",
    inversionValue: 8000,
    currency: "PEN",
    cpmRaw: "S/.8,50",
    cpmValue: 8.5,
    objectiveRaw: "941.176",
    objectiveValue: 941176,
    fechaInicio: "10/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "1.120.000",
    avanceValue: 1120000,
    pacingRaw: "119,00%",
    pacingValue: 119.0
  }
];

const DEFAULT_DIRECT_ANALYTICS_CAMPAIGNS = [
  {
    oppId: "OP-301101",
    oppName: "PE_Direct_Analytics_Havas_BMW_Serie3_CampañaMayo_301101",
    oc: "DA-99210",
    agencia: "Direct Analytics",
    cliente: "BMW",
    motivo: "Serie3",
    tipoCompra: "CPC",
    formato: "PremiumDCO",
    inversionRaw: "$12.000",
    inversionValue: 12000,
    currency: "USD",
    cpmRaw: "$0,85",
    cpmValue: 0.85,
    objectiveRaw: "14.117",
    objectiveValue: 14117,
    fechaInicio: "01/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "14.500",
    avanceValue: 14500,
    pacingRaw: "102,71%",
    pacingValue: 102.71
  },
  {
    oppId: "OP-301102",
    oppName: "PE_Direct_Analytics_GroupM_Entel_Portabilidad_CPC_Mayo26_301102",
    oc: "DA-99211",
    agencia: "Direct Analytics",
    cliente: "ENTEL",
    motivo: "Portabilidad",
    tipoCompra: "CPC",
    formato: "NativeFeed",
    inversionRaw: "S/.22.000",
    inversionValue: 22000,
    currency: "PEN",
    cpmRaw: "S/.1,50",
    cpmValue: 1.50,
    objectiveRaw: "14.667",
    objectiveValue: 14667,
    fechaInicio: "05/05/2026",
    fechaFin: "31/05/2026",
    mes: "mayo",
    avanceRaw: "11.200",
    avanceValue: 11200,
    pacingRaw: "76,36%",
    pacingValue: 76.36
  },
  {
    oppId: "OP-301103",
    oppName: "PE_Direct_Analytics_BBVA_Prestamos_Video_Abril26_301103",
    oc: "DA-99212",
    agencia: "Direct Analytics",
    cliente: "BBVA",
    motivo: "Prestamos",
    tipoCompra: "CPM",
    formato: "Lg",
    inversionRaw: "S/.9.500",
    inversionValue: 9500,
    currency: "PEN",
    cpmRaw: "S/.22,00",
    cpmValue: 22.0,
    objectiveRaw: "431.818",
    objectiveValue: 431818,
    fechaInicio: "01/04/2026",
    fechaFin: "30/04/2026",
    mes: "abril",
    avanceRaw: "510.000",
    avanceValue: 510000,
    pacingRaw: "118,11%",
    pacingValue: 118.11
  }
];

// Convert normal sheet URLs to direct CSV format
function getSpreadsheetCsvUrl(url: string, sheetName?: string): string {
  if (!url) return "";
  if (url.includes("docs.google.com/spreadsheets")) {
    const editPart = url.indexOf("/edit");
    if (editPart !== -1) {
      if (sheetName) {
        return url.substring(0, editPart) + `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      } else {
        return url.substring(0, editPart) + "/export?format=csv";
      }
    }
  }
  return url;
}

// REST Endpoint: Data fetcher
app.get("/api/data", async (req, res) => {
  const customUrl = req.query.url as string;
  const sheet = req.query.sheet as string || ""; // Target Sheet name
  const targetUrl = customUrl || "https://docs.google.com/spreadsheets/d/1nG2AtTKb0NfC1iOyEAEUC7ZQ0ClrEiuVW7ZKbrv-PKs/edit?usp=sharing";
  
  try {
    if (sheet === "" || sheet === "General") {
      let combinedData: any[] = [];
      let successCount = 0;
      
      // Intentar CAMU
      try {
        const camuUrl = getSpreadsheetCsvUrl(targetUrl, "CAMU");
        console.log(`Fetching CAMU from: ${camuUrl}`);
        const camuRes = await fetch(camuUrl);
        if (camuRes.ok) {
           const camuText = await camuRes.text();
           const camuParsed = parseCsvContent(camuText);
           if (camuParsed.length > 0) {
             combinedData = combinedData.concat(camuParsed);
             successCount++;
           }
        }
      } catch (e) {
        console.warn("Fallo CAMU:", e);
      }
      
      // Intentar CYN
      try {
        const cynUrl = getSpreadsheetCsvUrl(targetUrl, "CYN");
        console.log(`Fetching CYN from: ${cynUrl}`);
        const cynRes = await fetch(cynUrl);
        if (cynRes.ok) {
           const cynText = await cynRes.text();
           const cynParsed = parseCsvContent(cynText);
           if (cynParsed.length > 0) {
             combinedData = combinedData.concat(cynParsed);
             successCount++;
           }
        }
      } catch (e) {
        console.warn("Fallo CYN:", e);
      }

      // Si no se pudo obtener ninguna explícita (CAMU o CYN), intentamos export genérico (default de "Pacing General")
      if (successCount === 0 || combinedData.length === 0) {
        console.log(`Fallback fetching default general tab`);
        const csvExportUrl = getSpreadsheetCsvUrl(targetUrl, "");
        const response = await fetch(csvExportUrl);
        if (!response.ok) {
          throw new Error(`Google Sheets respondió con status ${response.status}`);
        }
        const text = await response.text();
        const parsedData = parseCsvContent(text);
        if (parsedData.length === 0) {
          throw new Error("No se encontraron registros de campaña válidos al parsear.");
        }
        combinedData = parsedData;
      }
      
      return res.json({
        success: true,
        source: targetUrl,
        campaigns: combinedData,
        isFallback: false,
      });

    } else {
      const csvExportUrl = getSpreadsheetCsvUrl(targetUrl, sheet);
      console.log(`Fetching spreadsheet (${sheet}) from: ${csvExportUrl}`);
      
      const response = await fetch(csvExportUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets respondió con status ${response.status}`);
      }
      
      const text = await response.text();
      const parsedData = parseCsvContent(text);
      
      if (parsedData.length === 0) {
        throw new Error("No se encontraron registros de campaña válidos al parsear.");
      }
      
      return res.json({
        success: true,
        source: targetUrl,
        campaigns: parsedData,
        isFallback: false,
      });
    }
  } catch (error: any) {
    console.warn(`Fallo cargando pestaña "${sheet || "default"}" de Google Sheets, se cargará el backup del excel:`, error.message);
    
    // Choose the corresponding fallback array
    let fallbackData = DEFAULT_CAMPAIGNS;
    if (sheet === "CYN") {
      fallbackData = DEFAULT_CYN_CAMPAIGNS;
    } else if (sheet === "Direct Analytics") {
      fallbackData = DEFAULT_DIRECT_ANALYTICS_CAMPAIGNS;
    } else if (sheet === "CAMU") {
      fallbackData = DEFAULT_CAMPAIGNS; // Assuming CAMU fallback is the main one
    }

    // if general requested and it failed, combine CAMU and CYN in fallback
    if ((sheet === "" || sheet === "General") && fallbackData === DEFAULT_CAMPAIGNS) {
      fallbackData = [...DEFAULT_CAMPAIGNS, ...DEFAULT_CYN_CAMPAIGNS];
    }

    return res.json({
      success: true,
      source: sheet ? `Offline Backup Local - Pestaña ${sheet}` : "Offline Backup Local (CAMU + CYN)",
      campaigns: fallbackData,
      isFallback: true,
      warning: error.message
    });
  }
});

// Helper: Generate a deterministic, realistic daily pacing curve with weekend dips
function generateDailyDelivery(campaign: any) {
  const startStr = campaign.fechaInicio || "01/04/2026";
  const endStr = campaign.fechaFin || "23/04/2026";

  const parseDmy = (str: string) => {
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        // DD/MM/YYYY
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    return new Date();
  };

  const startDate = parseDmy(startStr);
  const endDate = parseDmy(endStr);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
    // Fail-safe default range
    return Array.from({ length: 15 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (14 - i));
      const daily = Math.floor(campaign.avanceValue / 15 * (0.8 + Math.random() * 0.4));
      return {
        date: date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
        delivery: daily,
        accumulated: daily,
        targetAccumulated: Math.floor(campaign.objectiveValue / 15 * (i + 1))
      };
    });
  }

  const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const days: { dateStr: string; dayIndex: number; isWeekend: boolean }[] = [];
  
  let current = new Date(startDate);
  for (let i = 0; i < daysCount; i++) {
    const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
    days.push({
      dateStr: current.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
      dayIndex: i,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    });
    current.setDate(current.getDate() + 1);
  }

  // Distribute avanceValue and objectiveValue across days
  let totalWeight = 0;
  const weights = days.map((day) => {
    let weight = 1.0;
    // Add weekend dip (usually 25% lower delivery)
    if (day.isWeekend) {
      weight *= 0.75;
    }
    // Add slow start, peak in the middle, slow end (advertising campaigns curve)
    const relativePos = day.dayIndex / daysCount;
    const curve = Math.sin(relativePos * Math.PI); // Peak at 0.5
    weight *= (0.6 + 0.8 * curve);
    // Add random noise based on dayIndex + campaign avance to be deterministic
    const seed = (day.dayIndex * 13 + (campaign.avanceValue || 100)) % 100;
    const noise = 0.85 + (seed / 100) * 0.3; // between 0.85 and 1.15
    weight *= noise;

    totalWeight += weight;
    return weight;
  });

  let runningAvance = 0;
  let runningObj = 0;
  
  const campaignVtr = campaign.vtrValue || (campaign.formato && campaign.formato.toLowerCase().includes("video") ? 45.5 : 0);
  const campaignCtr = campaign.ctrValue || (campaign.tipoCompra === "CPC" ? 1.5 : 0.25);
  
  const totalClicks = campaign.clicksValue || Math.round((campaign.avanceValue || 0) * (campaignCtr / 100));
  const totalCompletions = Math.round((campaign.avanceValue || 0) * (campaignVtr / 100));
  const totalEngagements = Math.round((campaign.avanceValue || 0) * (0.012)); // mock ER 1.2%
  
  let runningClicksSum = 0;
  let runningCompletionsSum = 0;
  let runningEngagementsSum = 0;

  const resultPoints = days.map((day, idx) => {
    const weight = weights[idx];
    const dailyDelivery = Math.round(((campaign.avanceValue || 0) * weight) / totalWeight);
    const dailyTarget = Math.round((campaign.objectiveValue || 0) / daysCount);

    runningAvance += dailyDelivery;
    runningObj += dailyTarget;

    let dailyClick = 0;
    let dailyComp = 0;
    let dailyEng = 0;
    
    if (idx === daysCount - 1) {
      dailyClick = Math.max(0, totalClicks - runningClicksSum);
      dailyComp = Math.max(0, totalCompletions - runningCompletionsSum);
      dailyEng = Math.max(0, totalEngagements - runningEngagementsSum);
    } else {
      const share = dailyDelivery / (campaign.avanceValue || 1);
      const seed = (idx * 17 + totalClicks) % 100;
      const factor = 0.8 + (seed / 100) * 0.4;
      dailyClick = Math.min(dailyDelivery, Math.round(totalClicks * share * factor));
      
      const vSeed = (idx * 23 + totalCompletions) % 100;
      const vFactor = 0.85 + (vSeed / 100) * 0.3;
      dailyComp = Math.min(dailyDelivery, Math.round(totalCompletions * share * vFactor));

      const eSeed = (idx * 31 + totalEngagements) % 100;
      const eFactor = 0.85 + (eSeed / 100) * 0.3;
      dailyEng = Math.min(dailyDelivery, Math.round(totalEngagements * share * eFactor));
    }
    
    runningClicksSum += dailyClick;
    runningCompletionsSum += dailyComp;
    runningEngagementsSum += dailyEng;

    return {
      date: day.dateStr,
      delivery: dailyDelivery,
      accumulated: runningAvance,
      targetAccumulated: runningObj,
      clicks: dailyClick,
      accumulatedClicks: runningClicksSum,
      ctr: dailyDelivery > 0 ? (dailyClick / dailyDelivery) * 105 : 0,
      vtr: dailyDelivery > 0 && campaignVtr > 0 ? (dailyComp / dailyDelivery) * 100 : 0,
      er: dailyDelivery > 0 ? (dailyEng / dailyDelivery) * 100 : 0,
      targetClicksAccumulated: Math.round((totalClicks || 0) / daysCount * (idx + 1))
    };
  });

  // Normalize final point to exact totals to avoid rounding errors
  if (resultPoints.length > 0 && campaign.avanceValue) {
    const last = resultPoints[resultPoints.length - 1];
    const diff = campaign.avanceValue - last.accumulated;
    last.delivery += diff;
    last.accumulated = campaign.avanceValue;
    resultPoints[resultPoints.length - 1].targetAccumulated = campaign.objectiveValue;

    const diffClicks = totalClicks - last.accumulatedClicks;
    last.clicks += diffClicks;
    last.accumulatedClicks = totalClicks;
    last.ctr = last.delivery > 0 ? (last.clicks / last.delivery) * 100 : 0;
  }

  return resultPoints;
}

// REST Endpoint: Daily delivery details of a specific campaign
app.get("/api/daily-delivery", async (req, res) => {
  const customUrl = req.query.url as string;
  const oppId = req.query.oppId as string;
  const targetUrl = customUrl || "https://docs.google.com/spreadsheets/d/1nG2AtTKb0NfC1iOyEAEUC7ZQ0ClrEiuVW7ZKbrv-PKs/edit?usp=sharing";
  
  if (!oppId) {
    return res.status(400).json({ success: false, error: "Se requiere parámetro oppId" });
  }

  let campaignDetails: any = null;
  let campaignsList: any[] = [];

  try {
    // 1. Fetch campaigns from main sheets to have details
    const mainCsvUrl = getSpreadsheetCsvUrl(targetUrl);
    const mainResponse = await fetch(mainCsvUrl);
    if (mainResponse.ok) {
      const csvText = await mainResponse.text();
      campaignsList = parseCsvContent(csvText);
    }
  } catch (e) {
    console.warn("Fallo cargando campañas para daily-delivery, usando locales:", e);
  }

  if (campaignsList.length === 0) {
    campaignsList = [...DEFAULT_CAMPAIGNS, ...DEFAULT_CYN_CAMPAIGNS, ...DEFAULT_DIRECT_ANALYTICS_CAMPAIGNS];
  }

  campaignDetails = campaignsList.find(c => c.oppId === oppId) || 
                    campaignsList.find(c => c.oppName && c.oppName.includes(oppId));

  if (!campaignDetails) {
    campaignDetails = {
      oppId,
      oppName: `Campaña ${oppId}`,
      fechaInicio: "01/04/2026",
      fechaFin: "23/04/2026",
      avanceValue: 12000,
      objectiveValue: 11000,
      inversionValue: 5000,
      currency: "USD",
      cpmValue: 10.0,
      pacingValue: 109.09
    };
  }

  try {
    // 2. Fetch "Direct Analytics" tab for daily progress
    const dailyCsvUrl = getSpreadsheetCsvUrl(targetUrl, "Direct Analytics");
    console.log(`Fetching daily deliveries from "Direct Analytics": ${dailyCsvUrl}`);

    const dailyResponse = await fetch(dailyCsvUrl);
    if (!dailyResponse.ok) {
      throw new Error(`"Direct Analytics" sheet responded with code ${dailyResponse.status}`);
    }

    const csvText = await dailyResponse.text();
    const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length <= 1) {
      throw new Error("No hay suficientes filas en Direct Analytics");
    }

    // --- PIPING FORMAT PARSER ---
    // Look for a row where campaign ID matches, and extract daily values from a pipe cell.
    let finalPoints: any[] = [];
    const normalizedTargetOpp = oppId.toLowerCase().replace(/[._-]/g, '').trim();

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cells.length === 0) continue;
      
      const opIdFromRow = cells[0] || "";
      const normalizedRowOpp = opIdFromRow.toLowerCase().replace(/[._-]/g, '').trim();

      // Check for exact matching or cross-inclusion
      const isMatch = normalizedRowOpp.includes(normalizedTargetOpp) || normalizedTargetOpp.includes(normalizedRowOpp);
      
      if (isMatch) {
         const totalImpressions = cleanNumber(cells[1] || "0");
         const totalClicks = cleanNumber(cells[2] || "0");
         const totalSesiones = cleanNumber(cells[3] || "0");
         const totalER = cleanNumber(cells[5] || "0");
         const totalVTR = cleanNumber(cells[6] || "0");

         // Enriquecemos campaignDetails con los datos reales leídos de la fila
         campaignDetails.impressionsValue = totalImpressions;
         campaignDetails.clicksValue = totalClicks;
         campaignDetails.sesionesValue = totalSesiones;
         campaignDetails.erValue = totalER;
         campaignDetails.vtrValue = totalVTR;
         if (totalImpressions > 0 && campaignDetails.avanceValue !== totalImpressions) {
           campaignDetails.avanceValue = totalImpressions;
           campaignDetails.pacingValue = campaignDetails.objectiveValue > 0 ? (totalImpressions / campaignDetails.objectiveValue) * 100 : 0;
         }

         let dailyValues: number[] = [];
         let dailyClicks: number[] = [];
         
         // Gather potential pipe arrays or numeric cells in columns after index 8
         const potentialTubes: string[] = [];
         for (let colIdx = 9; colIdx < cells.length; colIdx++) {
           const val = cells[colIdx];
           if (val && (val.includes('|') || /^\d+$/.test(val))) {
             potentialTubes.push(val);
           }
         }

         const parseTube = (tubeStr: string): number[] => {
           return tubeStr.split('|').map(t => cleanNumber(t.trim()));
         };

         if (potentialTubes.length >= 2) {
           // Classified based on sum closeness to totalImpressions and totalClicks
           let bestImpTube = potentialTubes[0];
           let bestClickTube = potentialTubes[1];
           let minImpDiff = Infinity;
           let minClickDiff = Infinity;

           for (const tube of potentialTubes) {
             const tokens = parseTube(tube);
             const sum = tokens.reduce((s, v) => s + v, 0);

             const impDiff = Math.abs(sum - totalImpressions);
             const clickDiff = Math.abs(sum - totalClicks);

             if (impDiff < minImpDiff) {
               minImpDiff = impDiff;
               bestImpTube = tube;
             }
             if (clickDiff < minClickDiff) {
               minClickDiff = clickDiff;
               bestClickTube = tube;
             }
           }

           if (bestImpTube === bestClickTube) {
             // Fallback default assignments
             dailyValues = parseTube(potentialTubes[0]);
             dailyClicks = parseTube(potentialTubes[1]);
           } else {
             dailyValues = parseTube(bestImpTube);
             dailyClicks = parseTube(bestClickTube);
           }
         } else if (potentialTubes.length === 1) {
           const tokens = parseTube(potentialTubes[0]);
           const sum = tokens.reduce((s, v) => s + v, 0);

           const impDiff = Math.abs(sum - totalImpressions);
           const clickDiff = Math.abs(sum - totalClicks);

           if (impDiff < clickDiff) {
             dailyValues = tokens;
           } else {
             dailyClicks = tokens;
           }
         }

         // Ensure both are populated organically
         const numDays = Math.max(dailyValues.length, dailyClicks.length);
         if (numDays > 0) {
           if (dailyValues.length > 0 && dailyClicks.length === 0) {
             const sumImps = dailyValues.reduce((sum, v) => sum + v, 0) || totalImpressions || 1;
             let runningClicksSum = 0;
             for (let dayIdx = 0; dayIdx < dailyValues.length; dayIdx++) {
               const imp = dailyValues[dayIdx];
               if (dayIdx === dailyValues.length - 1) {
                 const lastClicks = Math.max(0, totalClicks - runningClicksSum);
                 dailyClicks.push(lastClicks);
               } else {
                 const share = imp / sumImps;
                 const seed = (dayIdx * 17 + totalClicks) % 100;
                 const factor = 0.8 + (seed / 100) * 0.4;
                 const dayClick = Math.min(imp, Math.round(totalClicks * share * factor));
                 dailyClicks.push(dayClick);
                 runningClicksSum += dayClick;
               }
             }
           }
           else if (dailyClicks.length > 0 && dailyValues.length === 0) {
             const sumClicks = dailyClicks.reduce((sum, v) => sum + v, 0) || totalClicks || 1;
             let runningImpsSum = 0;
             for (let dayIdx = 0; dayIdx < dailyClicks.length; dayIdx++) {
               const click = dailyClicks[dayIdx];
               if (dayIdx === dailyClicks.length - 1) {
                 const lastImps = Math.max(0, totalImpressions - runningImpsSum);
                 dailyValues.push(lastImps);
               } else {
                 const share = click / sumClicks;
                 const seed = (dayIdx * 13 + totalImpressions) % 100;
                 const factor = 0.85 + (seed / 100) * 0.3;
                 const dayImp = Math.round(totalImpressions * share * factor);
                 dailyValues.push(Math.max(click, dayImp));
                 runningImpsSum += dayImp;
               }
             }
           }
         } else {
           dailyValues = [totalImpressions || campaignDetails.avanceValue || 1000];
           dailyClicks = [totalClicks || 0];
         }
         
         if (dailyValues.length > 0) {
           const startStr = campaignDetails.fechaInicio || "01/04/2026";
           const endStr = campaignDetails.fechaFin || "23/04/2026";
           
           const safeParseDmy = (str: string) => {
             if (!str) return new Date(2026, 3, 1);
             const clean = str.replace(/[^\d/-]/g, '');
             const parts = clean.split(/[-/]/);
             if (parts.length === 3) {
               const p0 = parseInt(parts[0], 10);
               const p1 = parseInt(parts[1], 10);
               const p2 = parseInt(parts[2], 10);
               if (parts[0].length === 4) {
                 return new Date(p0, p1 - 1, p2);
               } else {
                 return new Date(p2, p1 - 1, p0);
               }
             }
             return new Date(2026, 3, 1);
           };

           const startDate = safeParseDmy(startStr);
           const endDate = safeParseDmy(endStr);
           
           let totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
           if (isNaN(totalDays) || totalDays <= 0) totalDays = 30;

           const N = dailyValues.length;
           const sumImps = dailyValues.reduce((sum, v) => sum + v, 0) || totalImpressions || 1;

           // Completions (VTR) distribution
           const totalCompletions = Math.round(totalImpressions * (totalVTR / 100));
           const dailyCompletions: number[] = [];
           let runningCompletionsSum = 0;
           for (let dayIdx = 0; dayIdx < N; dayIdx++) {
             const imp = dailyValues[dayIdx];
             if (dayIdx === N - 1) {
               const lastComp = Math.max(0, totalCompletions - runningCompletionsSum);
               dailyCompletions.push(Math.min(imp, lastComp));
             } else {
               const share = imp / sumImps;
               const seed = (dayIdx * 23 + Math.round(totalVTR)) % 100;
               const factor = 0.85 + (seed / 100) * 0.3;
               const dayComp = Math.min(imp, Math.round(totalCompletions * share * factor));
               dailyCompletions.push(dayComp);
               runningCompletionsSum += dayComp;
             }
           }

           // Engagements (ER) distribution (if applicable)
           const totalEngagements = Math.round(totalImpressions * (totalER / 100));
           const dailyEngagements: number[] = [];
           let runningEngagementsSum = 0;
           for (let dayIdx = 0; dayIdx < N; dayIdx++) {
             const imp = dailyValues[dayIdx];
             if (dayIdx === N - 1) {
               const lastEng = Math.max(0, totalEngagements - runningEngagementsSum);
               dailyEngagements.push(Math.min(imp, lastEng));
             } else {
               const share = imp / sumImps;
               const seed = (dayIdx * 31 + Math.round(totalER)) % 100;
               const factor = 0.85 + (seed / 100) * 0.3;
               const dayEng = Math.min(imp, Math.round(totalEngagements * share * factor));
               dailyEngagements.push(dayEng);
               runningEngagementsSum += dayEng;
             }
           }

           const totalPointsToGenerate = Math.max(totalDays, N);

           let runningAccum = 0;
           let runningClicksAccum = 0;
           let runningCompletionsAccum = 0;
           let runningEngagementsAccum = 0;

           for (let dayIdx = 0; dayIdx < totalPointsToGenerate; dayIdx++) {
             const currentDate = new Date(startDate);
             currentDate.setDate(startDate.getDate() + dayIdx);
             const dateStr = currentDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });

             const targetAccumulated = Math.round((campaignDetails.objectiveValue || 0) / totalDays * (dayIdx + 1));

             const pt: any = {
               date: dateStr,
               targetAccumulated: Math.min(targetAccumulated, campaignDetails.objectiveValue || 0),
               delivery: 0,
               clicks: 0,
               accumulated: runningAccum,
               accumulatedClicks: runningClicksAccum,
               ctr: 0,
               vtr: 0,
               er: 0,
               targetClicksAccumulated: Math.round((totalClicks || 0) / totalDays * (dayIdx + 1))
             };

             if (dayIdx < N) {
               const dailyVal = dailyValues[dayIdx];
               runningAccum += dailyVal;
               pt.delivery = dailyVal;
               pt.accumulated = runningAccum;

               const dClicks = dailyClicks[dayIdx] || 0;
               runningClicksAccum += dClicks;
               pt.clicks = dClicks;
               pt.accumulatedClicks = runningClicksAccum;
               pt.ctr = dailyVal > 0 ? (dClicks / dailyVal) * 100 : 0;

               const dComp = dailyCompletions[dayIdx] || 0;
               runningCompletionsAccum += dComp;
               pt.vtr = dailyVal > 0 ? (dComp / dailyVal) * 100 : 0;

               const dEng = dailyEngagements[dayIdx] || 0;
               runningEngagementsAccum += dEng;
               pt.er = dailyVal > 0 ? (dEng / dailyVal) * 100 : 0;
             } else {
               pt.delivery = null;
               pt.clicks = null;
               pt.accumulated = null;
               pt.accumulatedClicks = null;
               pt.ctr = null;
               pt.vtr = null;
               pt.er = null;
             }

             finalPoints.push(pt);
           }
           break;
         }
      }
    }

    if (finalPoints.length === 0) {
      // --- BACKWARD COMPATIBILITY FORMAT PARSERS (COLUMNAR / ROW-BASED) ---
      const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
      
      const dateColIdx = rawHeaders.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes("fecha") || lower.includes("date") || lower.includes("dia") || lower.includes("día");
      });

      const opColumnHeaderIdx = rawHeaders.findIndex(h => {
        return h.toLowerCase().includes(oppId.toLowerCase()) || oppId.toLowerCase().includes(h.toLowerCase());
      });

      const parsedPoints: { date: string; delivery: number }[] = [];

      if (dateColIdx !== -1 && opColumnHeaderIdx !== -1 && dateColIdx !== opColumnHeaderIdx) {
        console.log(`Found columnar match for ${oppId} in column ${opColumnHeaderIdx}`);
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cells.length > Math.max(dateColIdx, opColumnHeaderIdx)) {
            const date = cells[dateColIdx];
            const val = cleanNumber(cells[opColumnHeaderIdx]);
            if (date && val >= 0) {
              parsedPoints.push({ date, delivery: val });
            }
          }
        }
      } else {
        const opColIdx = rawHeaders.findIndex(h => {
          const lower = h.toLowerCase();
          return lower.includes("op") || lower.includes("camp") || lower.includes("id") || lower.includes("opp");
        });
        const deliveryColIdx = rawHeaders.findIndex(h => {
          const lower = h.toLowerCase();
          return lower.includes("entrega") || lower.includes("avance") || lower.includes("imp") || lower.includes("click") || lower.includes("diaria") || lower.includes("valor");
        });

        if (dateColIdx !== -1 && opColIdx !== -1 && deliveryColIdx !== -1) {
          console.log(`Found row-based delivery pattern.`);
          for (let i = 1; i < lines.length; i++) {
            const cells = parseCSVLine(lines[i]).map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length > Math.max(dateColIdx, opColIdx, deliveryColIdx)) {
              const rowOp = cells[opColIdx];
              const date = cells[dateColIdx];
              const val = cleanNumber(cells[deliveryColIdx]);
              
              if (rowOp && rowOp.toLowerCase().replace(/[_-]/g, '').includes(oppId.toLowerCase().replace(/[_-]/g, ''))) {
                parsedPoints.push({ date, delivery: val });
              }
            }
          }
        }
      }

      if (parsedPoints.length > 0) {
        let runningAccumulated = 0;
        let runningClicksAccumulated = 0;
        const totalClicks = campaignDetails.clicksValue || Math.round((campaignDetails.avanceValue || 0) * 0.0025);
        
        finalPoints = parsedPoints.map((pt, index) => {
          runningAccumulated += pt.delivery;
          const targetUnit = (campaignDetails.objectiveValue || 0) / parsedPoints.length;
          const targetAccumulated = Math.round(targetUnit * (index + 1));
          
          const share = pt.delivery / (campaignDetails.avanceValue || 1);
          const dClicks = Math.round(totalClicks * share);
          runningClicksAccumulated += dClicks;

          return {
            date: pt.date,
            delivery: pt.delivery,
            accumulated: runningAccumulated,
            targetAccumulated,
            clicks: dClicks,
            accumulatedClicks: runningClicksAccumulated,
            ctr: pt.delivery > 0 ? (dClicks / pt.delivery) * 100 : 0,
            vtr: campaignDetails.vtrValue || 0,
            er: campaignDetails.erValue || 0,
            targetClicksAccumulated: Math.round((totalClicks || 0) / parsedPoints.length * (index + 1))
          };
        });
      }
    }

    if (finalPoints.length === 0) {
      throw new Error(`En la pestaña "Direct Analytics" no se encontraron datos correspondientes a la OP: ${oppId}`);
    }

    return res.json({
      success: true,
      source: `Google Sheets (Pestaña "Direct Analytics")`,
      campaign: campaignDetails,
      dailyData: finalPoints,
      isRealData: true
    });

  } catch (error: any) {
    console.warn(`Generando curva simulada como fallback para la OP ${oppId}: ${error.message}`);
    const generatedPoints = generateDailyDelivery(campaignDetails);
    
    return res.json({
      success: true,
      source: `Backup Local Generado (Rango de fechas campaña)`,
      campaign: campaignDetails,
      dailyData: generatedPoints,
      isRealData: false,
      warning: error.message
    });
  }
});

// REST Endpoint: Strategic AI Summary & Diagnostics using Gemini
app.post("/api/analyze", async (req, res) => {
  const { campaigns } = req.body;
  
  if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
    return res.status(400).json({ error: "Debe proveer una lista de campañas para analizar" });
  }

  if (!aiClient) {
    return res.json({
      success: false,
      error: "La API Key de Gemini no está configurada. Agréguela en Configuración > Secretos en el panel de AI Studio."
    });
  }

  try {
    const summaryPrompt = `
      Actúa como un experto analista sénior de medios digitales de perfomance y branding.
      Examina la siguiente lista de campañas publicitarias digitales de Google Sheets. Cada campaña tiene metas de entrega (OBJ), avances (Avance), presupuestos (Inversión), CPM, fechas de ejecución y un indicador de ritmo de entrega acumulado (Pacing %).
      
      Lista de Campañas:
      ${JSON.stringify(campaigns.map(c => ({
        oppId: c.oppId,
        oppName: c.oppName,
        agencia: c.agencia,
        cliente: c.cliente,
        inversion: c.inversionRaw,
        pacing: c.pacingRaw,
        avance: c.avanceRaw,
        obj: c.objectiveRaw,
        inicio: c.fechaInicio,
        fin: c.fechaFin,
        mes: c.mes
      })), null, 2)}

      Instrucciones estratégicas para el análisis:
      1. Redacta un reporte ejecutivo general detallado de 2-3 párrafos cortos (generalReport) explicando el rendimiento de entrega total, identificando si hay tendencias preocupantes (e.g., campañas en Mayo que acaban de iniciar y ya están quemando demasiado rápido, o campañas estancadas que comprometen la meta de facturación).
      2. Agrega una lista de anomalías críticas (anomalies) de campañas con severidad (high, medium, low). Incluye campañas con:
         - Sobregiro/Quemado acelerado (pacing mayor a 115%), como por ejemplo Skechers con 174% o Natura con 150%.
         - Subentrega severa (pacing menor a 85%), especialmente para campañas que ya deberían estar entregando como CarouselCompanion con 73.85%, o Tambo con 18% que está en peligro crítico de subentrega.
      3. Brinda una lista de recomendaciones de reasignación presupuestaria (recommendations). Propón con ID de origen (sourceOppId) y destino (targetOppId) reasignaciones tácticas coherentes de presupuesto de campañas que están sobre-entregando o desperdiciando inventario hacia campañas que están retrasadas para equilibrarse e impulsar la facturación general de la cuenta.

      Escribe toda la respuesta en ESPAÑOL profesional.
    `;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: summaryPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            generalReport: {
              type: Type.STRING,
              description: "Reporte estratégico y ejecutivo en español sobre el estado general del portafolio"
            },
            anomalies: {
              type: Type.ARRAY,
              description: "Campañas individuales con problemas críticos de ritmo (subentrega o sobreentrega)",
              items: {
                type: Type.OBJECT,
                properties: {
                  oppId: { type: Type.STRING },
                  oppName: { type: Type.STRING },
                  cliente: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
                  issue: { type: Type.STRING, description: "Causa de la alarma del pacing detallada" },
                  metrics: {
                    type: Type.OBJECT,
                    properties: {
                      inversion: { type: Type.STRING },
                      pacing: { type: Type.STRING },
                      avance: { type: Type.STRING },
                      obj: { type: Type.STRING }
                    },
                    required: ["inversion", "pacing", "avance", "obj"]
                  }
                },
                required: ["oppId", "oppName", "cliente", "severity", "issue", "metrics"]
              }
            },
            recommendations: {
              type: Type.ARRAY,
              description: "Recomendaciones tácticas de rebalance de presupuesto",
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceOppId: { type: Type.STRING },
                  targetOppId: { type: Type.STRING },
                  action: { type: Type.STRING, description: "Acción de reasignación recomendada" },
                  justification: { type: Type.STRING, description: "Explicación por qué se retira y añade de estas OPPs" },
                  estimatedImpact: { type: Type.STRING, description: "Impacto del rebalance en los KPIs generales de entrega" }
                },
                required: ["sourceOppId", "targetOppId", "action", "justification", "estimatedImpact"]
              }
            }
          },
          required: ["generalReport", "anomalies", "recommendations"]
        }
      }
    });

    const parsedResponse = JSON.parse(response.text.trim());
    return res.json({
      success: true,
      analysis: parsedResponse,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Fallo generando insights de Gemini:", error);
    return res.status(500).json({
      success: false,
      error: "Ocurrió un error en el motor analítico de Gemini",
      details: error.message
    });
  }
});

// Configure Vite integration
async function startViteServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Media Pacing Server] running on http://0.0.0.0:${PORT}`);
  });
}

startViteServer();
