export type FloorId = "A" | "F" | "1" | "2" | "3" | "4";
export type PlaceKind = "teaching" | "office" | "research" | "service" | "outdoor" | "circulation";

export interface Place {
  id: string;
  floor: FloorId;
  name: string;
  code?: string;
  short: string;
  kind: PlaceKind;
  path?: string;
  x: number;
  y: number;
  range?: [string, number, number];
  note?: string;
  keywords?: string[];
  secondaryLabels?: { x: number; y: number; text: string }[];
}

export const FLOORS: { id: FloorId; name: string; caption: string }[] = [
  { id: "A", name: "Alagsor", caption: "Bécsi úti bejárat, porta és mélygarázs" },
  { id: "F", name: "Földszint", caption: "Aula, előadók és közösségi terek" },
  { id: "1", name: "1. emelet", caption: "Előadó, irodák és laborok" },
  { id: "2", name: "2. emelet", caption: "Rektori terület, NIK és EKIK" },
  { id: "3", name: "3. emelet", caption: "NIK intézetek" },
  { id: "4", name: "4. emelet", caption: "Dékáni hivatal és NIK" },
];

export const PLACES: Place[] = [
  { id: "a-entrance", floor: "A", name: "Bécsi úti bejárat", short: "BE", kind: "circulation", x: 230, y: 510, note: "A fotón jelölt épületbejárat." },
  { id: "a-reception", floor: "A", name: "Porta", short: "Porta", kind: "service", path: "M280 375H455V490H280Z", x: 367, y: 433, note: "A bejárat közelében jelölt recepció." },
  { id: "a-defib", floor: "A", name: "Automata külső defibrillátor", short: "AED", kind: "service", x: 472, y: 488, keywords: ["életmentő", "defibrillátor"] },
  { id: "a-garage", floor: "A", name: "Teremgarázs", short: "Mélygarázs", kind: "service", path: "M510 215H970V490H510Z", x: 740, y: 350, keywords: ["parkoló", "autó"] },
  { id: "a-stairs", floor: "A", name: "Lépcső", short: "L", kind: "circulation", x: 445, y: 347 },
  { id: "a-lift", floor: "A", name: "Felvonó", short: "Lift", kind: "circulation", x: 490, y: 347 },

  { id: "f-entrance", floor: "F", name: "Udvari bejárat", short: "BE", kind: "circulation", x: 512, y: 507, note: "A földszinti udvar felől jelölt bejárat." },
  { id: "f-court", floor: "F", name: "Udvar", short: "Udvar", kind: "outdoor", path: "M82 296H299V483H82Z", x: 190, y: 389 },
  { id: "f-garden", floor: "F", name: "Belső kert", short: "Belső kert", kind: "outdoor", path: "M103 180H299V280H103Z", x: 201, y: 230 },
  { id: "f-01", floor: "F", name: "Előadó", code: "F.01", short: "F.01", kind: "teaching", path: "M321 275H485V397H321Z", x: 403, y: 336 },
  { id: "f-02", floor: "F", name: "Előadó", code: "F.02", short: "F.02", kind: "teaching", path: "M505 206H583V287H505Z", x: 544, y: 247 },
  { id: "f-03", floor: "F", name: "Előadó", code: "F.03", short: "F.03", kind: "teaching", path: "M589 206H667V287H589Z", x: 628, y: 247 },
  { id: "f-04", floor: "F", name: "Előadó", code: "F.04", short: "F.04", kind: "teaching", path: "M673 206H751V287H673Z", x: 712, y: 247 },
  { id: "f-05", floor: "F", name: "Előadó", code: "F.05", short: "F.05", kind: "teaching", path: "M757 206H835V287H757Z", x: 796, y: 247 },
  { id: "f-06", floor: "F", name: "Előadó", code: "F.06", short: "F.06", kind: "teaching", path: "M841 206H963V287H841Z", x: 902, y: 247 },
  { id: "f-aula", floor: "F", name: "Aula", short: "Aula", kind: "teaching", path: "M505 313H850V443H505Z", x: 676, y: 378, note: "A földszint központi, nyilvános tere." },
  { id: "f-07", floor: "F", name: "Előadó", code: "F.07", short: "F.07", kind: "teaching", path: "M530 468H646V545H530Z", x: 588, y: 507 },
  { id: "f-08", floor: "F", name: "Előadó", code: "F.08", short: "F.08", kind: "teaching", path: "M652 468H768V545H652Z", x: 710, y: 507 },
  { id: "f-09", floor: "F", name: "Wolfgang E. Pauli konferenciaterem", code: "F.09", short: "F.09", kind: "teaching", path: "M862 468H1011V545H862Z", x: 936, y: 507 },
  { id: "f-cafe", floor: "F", name: "Büfé", short: "Büfé", kind: "service", path: "M865 324H1011V426H865Z", x: 938, y: 375, keywords: ["kávézó", "étel"] },
  { id: "f-rest", floor: "F", name: "Pihenőtér", short: "PIH", kind: "service", x: 484, y: 442 },
  { id: "f-wc", floor: "F", name: "Mosdó", short: "WC", kind: "service", x: 1026, y: 317 },
  { id: "f-accessible-wc", floor: "F", name: "Akadálymentes mosdó", short: "♿", kind: "service", x: 1026, y: 365, keywords: ["wc"] },
  { id: "f-smoking", floor: "F", name: "Dohányzásra kijelölt hely", short: "D", kind: "outdoor", x: 193, y: 505 },
  { id: "f-stairs", floor: "F", name: "Lépcső", short: "L", kind: "circulation", x: 480, y: 307 },
  { id: "f-lift", floor: "F", name: "Felvonó", short: "Lift", kind: "circulation", x: 865, y: 303 },

  { id: "1-doberdo", floor: "1", name: "Doberdó úti bejárat", short: "BE", kind: "circulation", x: 223, y: 540, note: "A fotón az 1. emeleti szint mellett jelölt bejárat." },
  { id: "1-rector", floor: "1", name: "Rektori hivatal", code: "1.01–1.09", short: "Rektori hivatal", kind: "office", path: "M180 222H365V337H180Z", x: 272, y: 278, range: ["1", 1, 9] },
  { id: "1-nik", floor: "1", name: "NIK laboratóriumok", short: "NIK laborok", kind: "research", path: "M370 222H870V337H370Z", x: 620, y: 278, note: "A fotó laboratóriumi területként jelöli; egyedi teremajtók nem olvashatók ki." },
  { id: "1-auditorium", floor: "1", name: "Kármán Tódor nagyelőadó", code: "1.32", short: "1.32 · Nagyelőadó", kind: "teaching", path: "M750 436C750 402 794 389 846 389C897 389 942 403 942 436C942 468 897 481 846 481C794 481 750 468 750 436Z", x: 846, y: 436 },
  { id: "1-ekik", floor: "1", name: "Egyetemi Kutató és Információs Központ", short: "EKIK", kind: "research", path: "M180 394H475V475H180Z", x: 327, y: 434, note: "A fotón EKIK-területként jelölve." },
  { id: "1-emeritus", floor: "1", name: "Rector Emeritus iroda", short: "Emeritus", kind: "office", path: "M495 394H610V475H495Z", x: 552, y: 434 },
  { id: "1-meeting", floor: "1", name: "Tárgyaló", short: "Tárgyaló", kind: "office", path: "M615 394H730V475H615Z", x: 672, y: 434 },
  { id: "1-bridge", floor: "1", name: "Híd", short: "Híd", kind: "circulation", x: 482, y: 362 },
  { id: "1-wc", floor: "1", name: "Mosdó", short: "WC", kind: "service", x: 953, y: 356 },
  { id: "1-stairs", floor: "1", name: "Lépcső", short: "L", kind: "circulation", x: 388, y: 355 },
  { id: "1-lift", floor: "1", name: "Felvonó", short: "Lift", kind: "circulation", x: 871, y: 355 },

  { id: "2-rector", floor: "2", name: "Rektori kabinet", code: "2.01–2.09", short: "Rektori kabinet", kind: "office", path: "M176 215H341V326H176Z", x: 258, y: 270, range: ["2", 1, 9] },
  { id: "2-meeting", floor: "2", name: "Rektori tanácsterem", code: "2.02", short: "Tanácsterem", kind: "office", path: "M346 215H490V326H346Z", x: 418, y: 270, note: "A tábla külön is megnevezi a 2.02-es tanácstermet." },
  { id: "2-nik", floor: "2", name: "NIK laboratóriumok", code: "2.10–2.20", short: "NIK laborok", kind: "research", path: "M495 215H1014V326H495Z", x: 754, y: 270, range: ["2", 10, 20] },
  { id: "2-ekik", floor: "2", name: "Egyetemi Kutató és Információs Központ", code: "2.21–2.36", short: "EKIK", kind: "research", path: "M176 394H636V478H176Z", x: 406, y: 435, range: ["2", 21, 36], note: "A fotón kutatói és innovációs területként jelölve." },
  { id: "2-ekik-office", floor: "2", name: "EKIK főigazgatói iroda", short: "EKIK iroda", kind: "office", path: "M644 394H781V478H644Z", x: 712, y: 435 },
  { id: "2-wc", floor: "2", name: "Mosdó", short: "WC", kind: "service", x: 964, y: 368 },
  { id: "2-stairs", floor: "2", name: "Lépcső", short: "L", kind: "circulation", x: 494, y: 360 },
  { id: "2-lift", floor: "2", name: "Felvonó", short: "Lift", kind: "circulation", x: 850, y: 360 },

  { id: "3-nik", floor: "3", name: "NIK intézeti terület", code: "3.01–3.28", short: "NIK · 3.01–3.28", kind: "research", path: "M174 230H575V339H174ZM580 230H1020V339H580ZM174 396H575V480H174ZM580 396H1020V480H580Z", x: 374, y: 284, range: ["3", 1, 28], secondaryLabels: [{ x: 800, y: 284, text: "NIK" }, { x: 374, y: 437, text: "NIK" }, { x: 800, y: 437, text: "NIK" }], note: "A tábla a Biomatika és Alkalmazott Mesterséges Intelligencia, a Kiberfizikai Rendszerek, valamint a Szoftvertervezés és Fejlesztés intézeteit jelöli ezen a szinten. A pontos szobabeosztás nem látszik." },
  { id: "3-wc", floor: "3", name: "Mosdó", short: "WC", kind: "service", x: 952, y: 375 },
  { id: "3-stairs", floor: "3", name: "Lépcső", short: "L", kind: "circulation", x: 578, y: 373 },
  { id: "3-lift", floor: "3", name: "Felvonó", short: "Lift", kind: "circulation", x: 626, y: 373 },

  { id: "4-dean", floor: "4", name: "Dékáni hivatal", code: "4.01", short: "4.01 · Dékáni hivatal", kind: "office", path: "M174 230H385V339H174Z", x: 279, y: 284 },
  { id: "4-meeting", floor: "4", name: "Dékáni tanácsterem", short: "Tanácsterem", kind: "office", path: "M390 230H558V339H390Z", x: 474, y: 284 },
  { id: "4-nik", floor: "4", name: "Neumann János Informatikai Kar", code: "4.02–4.28", short: "NIK · 4.02–4.28", kind: "office", path: "M563 230H1020V339H563ZM174 396H1020V480H174Z", x: 791, y: 284, range: ["4", 2, 28], secondaryLabels: [{ x: 592, y: 438, text: "NIK" }], note: "A tábla az Alkalmazott Matematikai Intézetet is itt jelöli." },
  { id: "4-wc", floor: "4", name: "Mosdó", short: "WC", kind: "service", x: 953, y: 377 },
  { id: "4-stairs", floor: "4", name: "Lépcső", short: "L", kind: "circulation", x: 578, y: 374 },
  { id: "4-lift", floor: "4", name: "Felvonó", short: "Lift", kind: "circulation", x: 626, y: 374 },
];
