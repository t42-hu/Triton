export type FloorId = "A" | "F" | "1" | "2" | "3" | "4";
export type PlaceKind = "teaching" | "office" | "research" | "service" | "outdoor" | "circulation" | "parking" | "roof";

export interface Place {
  id: string;
  floor: FloorId;
  name: string;
  code?: string;
  short: string;
  kind: PlaceKind;
  tone?: PlaceKind;
  path?: string;
  symbol?: "stairs";
  rotation?: number;
  labelFontSize?: number;
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
  {id: "a-entrance", floor: "A", name: "Bécsi úti bejárat", short: "BE", kind: "circulation", x: 448, y: 872, note: "A Bécsi út felől jelölt alagsori bejárat."},
  {id: "a-reception", floor: "A", name: "Porta", short: "Porta", kind: "service", x: 350, y: 823, note: "A Bécsi úti bejáratnál jelölt recepció."},
  {id: "a-defib", floor: "A", name: "Automata külső defibrillátor", short: "AED", kind: "service", x: 290, y: 835, keywords: ["életmentő", "defibrillátor"]},
  {id: "a-garage", floor: "A", name: "Teremgarázs", short: "Mélygarázs", kind: "parking", path: "M132 426H575V345H805V718H700V849H615V750H495V718H132Z", x: 460, y: 565, keywords: ["parkoló", "autó"]},
  {id: "a-stairs", floor: "A", name: "Lépcső", short: "L", kind: "circulation", symbol: "stairs", x: 448, y: 780, rotation: 270},
  {id: "a-lift", floor: "A", name: "Felvonó", short: "Lift", kind: "circulation", x: 490, y: 755},
  {id: "a-private", floor: "A", name: "Nem nyilvános helyiségek", short: "Üzemi terület", kind: "service", x: 280, y: 347, path: "M132 270H535V426H132Z", tone: "circulation", note: "A táblán világos színnel jelölt, nem nyilvános kiszolgáló terület."},
  {id: "a-west-lift", floor: "A", name: "Nyugati felvonó", short: "Lift", kind: "circulation", x: 450, y: 300},
  {id: "a-west-stairs", floor: "A", name: "Nyugati lépcső", short: "L", kind: "circulation", x: 420, y: 300, symbol: "stairs", rotation: 90},
  {id: "a-garage-entry", floor: "A", name: "Garázsbehajtó", short: "Autó", kind: "circulation", x: 680, y: 875},

  { id: "f-entrance", floor: "F", name: "Földszinti bejárat", short: "BE", kind: "circulation", x: 448, y: 850, note: "Bejárat az előtéren és az egyenes lépcsőkaron át az aula felé." },
  { id: "f-garden", floor: "F", name: "Belső kert", short: "Belső kert", kind: "outdoor", path: "M575 345L1107 240V447H575Z", x: 860, y: 377 },
  { id: "f-court", floor: "F", name: "Belső udvar", short: "Belső udvar", kind: "outdoor", path: "M118 426H430V703H118Z", x: 276, y: 570 },
  { id: "f-01", floor: "F", name: "Előadó", code: "F.01", short: "F.01", kind: "teaching", path: "M132 270H405V426H132Z", x: 268, y: 348 },
  { id: "f-02", rotation: -11.43, floor: "F", name: "Előadó", code: "F.02", short: "F.02", kind: "teaching", path: "M 543 220 L 648 198 L 680 278 L 575 300 Z", x: 612, y: 249 },
  { id: "f-03", rotation: -11.43, floor: "F", name: "Előadó", code: "F.03", short: "F.03", kind: "teaching", path: "M 654 197 L 759 175 L 791 255 L 686 277 Z", x: 723, y: 226 },
  { id: "f-04", rotation: -11.43, floor: "F", name: "Előadó", code: "F.04", short: "F.04", kind: "teaching", path: "M 765 174 L 870 152 L 902 232 L 797 254 Z", x: 834, y: 203 },
  { id: "f-05", rotation: -11.43, floor: "F", name: "Előadó", code: "F.05", short: "F.05", kind: "teaching", path: "M 923 143 L 1048 117 L 1080 197 L 955 223 Z", x: 1003, y: 170 },
  { id: "f-06", rotation: -11.43, floor: "F", name: "Előadó", code: "F.06", short: "F.06", kind: "teaching", path: "M 1058 116 L 1186 90 L 1235 214 L 1107 240 Z", x: 1146, y: 165 },
  { id: "f-aula", floor: "F", name: "Aula", short: "Aula", kind: "teaching", path: "M430 263L543 220L575 300V703H430Z", x: 505, y: 490, note: "A földszint központi, nyitott tere; a fotón nem külön zárt teremként látszik." },
  { id: "f-07", floor: "F", name: "Előadó", code: "F.07", short: "F.07", kind: "teaching", path: "M155 703H267V789H155Z", x: 211, y: 746 },
  { id: "f-08", floor: "F", name: "Előadó", code: "F.08", short: "F.08", kind: "teaching", path: "M274 735H422V849H274Z", x: 348, y: 792 },
  { id: "f-09", floor: "F", name: "Wolfgang E. Pauli konferenciaterem", code: "F.09", short: "F.09", kind: "teaching", path: "M536 735H684V849H536Z", x: 610, y: 792 },
  { id: "f-cafe", floor: "F", name: "Büfé", short: "Büfé", kind: "service", path: "M 684 479 H 711 C 772 479 805 521 805 575 C 805 630.5 772 671 711 671 H 684 Z", x: 741, y: 575, keywords: ["kávézó", "étel"] },
  { id: "f-rest", floor: "F", name: "Pihenőtér", short: "PIH", kind: "service", x: 422, y: 376 },
  { id: "f-wc", floor: "F", name: "Mosdók", keywords: ["akadálymentes", "AM", "wc"], short: "WC", kind: "service", path: "M 575 504 H 684 V 646 H 575 Z", x: 629.5, y: 575 },
  { id: "f-stairs", floor: "F", name: "Lépcső az F.02 mellett a Doberdó út felé", short: "L", kind: "circulation", symbol: "stairs", rotation: 248.19859051, x: 527, y: 281.44914087 },
  { id: "f-entry-stairs", floor: "F", name: "Bejárati lépcső az Auditorium Maximum felé", short: "L", kind: "circulation", symbol: "stairs", rotation: 270, x: 448, y: 780 },
  { id: "f-wc-stairs-north", floor: "F", name: "Felfelé vezető lépcső a WC fölött", short: "L", kind: "circulation", symbol: "stairs", rotation: 0, x: 625, y: 463 },
  { id: "f-wc-stairs-south", floor: "F", name: "Felfelé vezető lépcső a WC alatt", short: "L", kind: "circulation", symbol: "stairs", rotation: 0, x: 625, y: 687 },
  { id: "f-lift", floor: "F", name: "Felvonó az F.04 és F.05 között", short: "Lift", kind: "circulation", x: 913, y: 190 },

  {id: "1-doberdo", floor: "1", name: "Doberdó úti bejárat", short: "BE", kind: "circulation", x: 527, y: 232, note: "A Doberdó út felől jelölt 1. emeleti bejárat."},
  {id: "1-rector", floor: "1", name: "Rektori hivatal", code: "1.01–1.09", short: "Rektori hivatal", kind: "office", path: "M132 270H405V323H132ZM132 363H405V426H132Z", x: 268, y: 298, range: ["1", 1, 9], secondaryLabels: [{x: 268, y: 394, text: "Rektori hivatal"}]},
  {id: "1-nik", rotation: -11.43, floor: "1", name: "NIK laboratóriumok", short: "NIK", kind: "research", tone: "teaching", path: "M543 220L868 154.29L884.8 196.29L559.8 262ZM933 141.15L1186 90L1202.8 132L949.8 183.15ZM575 300L900 234.29L917.6 278.29L592.6 344ZM965 221.15L1218 170L1235.6 214L982.6 265.15Z", x: 720, y: 208, secondaryLabels: [{x: 1080, y: 134, text: "NIK"}, {x: 752, y: 289, text: "NIK"}, {x: 1112, y: 215, text: "NIK"}], note: "A fotó kétoldali laboratóriumi szárnyakat jelöl; egyedi teremajtók nem olvashatók ki."},
  {id: "1-auditorium", floor: "1", name: "Kármán Tódor nagyelőadó", code: "1.32", short: "1.32", kind: "teaching", path: "M550 575C550 510 605 475 690 475C775 475 830 510 830 575C830 640 775 675 690 675C605 675 550 640 550 575Z", x: 690, y: 575},
  {id: "1-audmax-stairs-north", floor: "1", name: "Lépcső az Auditorium Maximum felső bejáratához", short: "L", kind: "circulation", symbol: "stairs", rotation: 0, x: 625, y: 463, note: "A nagyelőadó felső oldalán jelölt lépcső."},
  {id: "1-audmax-stairs-south", floor: "1", name: "Lépcső az Auditorium Maximum alsó bejáratához", short: "L", kind: "circulation", symbol: "stairs", rotation: 0, x: 625, y: 687, note: "A nagyelőadó alsó, EKIK felőli oldalán jelölt lépcső."},
  {id: "1-ekik", floor: "1", name: "Egyetemi Kutató és Információs Központ", short: "EKIK", kind: "research", path: "M536 799H608V849H536Z", x: 572, y: 824, note: "A frontoldali mag mellett, a táblán jelölt kisebb kutatói terület."},
  {id: "1-ekik-research", floor: "1", name: "EKIK kutatói terület", short: "EKIK", kind: "research", path: "M155 703H422V849H274V789H155Z", x: 300, y: 753, note: "Az F.07/F.08 feletti EKIK-szárny; a táblán egyedi ajtóhelyek nem látszanak."},
  {id: "1-emeritus", floor: "1", name: "Rector Emeritus iroda", short: "Emer.", kind: "office", path: "M614 799H684V849H614Z", x: 649, y: 824, tone: "research", note: "A táblán az alsó keleti EKIK-csoport szélső irodája."},
  {id: "1-meeting", floor: "1", name: "Tárgyaló", short: "Tárgyaló", kind: "office", path: "M536 735H624V783H536Z", x: 580, y: 759, tone: "research", note: "A táblán asztaljellel jelölt tárgyaló a frontoldali EKIK-csoportban."},
  {id: "1-bridge", floor: "1", name: "Híd", short: "Híd", kind: "circulation", x: 473, y: 539},
  {id: "1-wc", floor: "1", name: "Mosdó", short: "WC", kind: "service", x: 482.5, y: 382, path: "M460 365H505V399H460Z"},
  {id: "1-stairs", floor: "1", name: "Északi lépcső", short: "L", kind: "circulation", x: 889, y: 166, symbol: "stairs", rotation: 78.5},
  {id: "1-lift", floor: "1", name: "Északi felvonó", short: "Lift", kind: "circulation", x: 913, y: 190},
  {id: "1-west-lift", floor: "1", name: "Nyugati felvonó", short: "Lift", kind: "circulation", x: 450, y: 300},
  {id: "1-west-stairs", floor: "1", name: "Nyugati lépcső", short: "L", kind: "circulation", x: 420, y: 300, symbol: "stairs", rotation: 90},
  {id: "1-hall-lift", floor: "1", name: "Felvonó a nyugati közlekedőnél", short: "Lift", kind: "circulation", x: 522, y: 372},
  {id: "1-front-lift", floor: "1", name: "Frontoldali felvonó", short: "Lift", kind: "circulation", x: 490, y: 755},
  {id: "1-front-stairs", floor: "1", name: "Frontoldali lépcső", short: "L", kind: "circulation", x: 448, y: 780, symbol: "stairs", rotation: 270},
  {id: "1-front-wc", floor: "1", name: "Frontoldali mosdó", short: "WC", kind: "service", x: 460, y: 712, path: "M430 697H490V727H430Z"},
  {id: "1-north-wc", rotation: -11.43, labelFontSize: 11, floor: "1", name: "Északi mosdó", short: "WC", kind: "service", x: 943.5, y: 257.5, path: "M923 246L952 240L964 269L935 275Z"},

  {id: "2-rector", floor: "2", name: "Rektori kabinet", code: "2.01–2.09", short: "Rektori kabinet", kind: "office", path: "M132 363H405V426H132Z", x: 268, y: 394, range: ["2", 1, 9]},
  {id: "2-meeting", floor: "2", name: "Rektori tanácsterem", code: "2.02", short: "2.02", kind: "office", path: "M132 270H267V323H132Z", x: 199.5, y: 296.5, note: "A tábla külön is megnevezi a 2.02-es tanácstermet."},
  {id: "2-nik", rotation: -11.43, floor: "2", name: "NIK laboratóriumok", code: "2.10–2.20", short: "NIK", kind: "research", tone: "teaching", path: "M543 220L868 154.29L884.8 196.29L559.8 262ZM933 141.15L1186 90L1202.8 132L949.8 183.15ZM575 300L900 234.29L917.6 278.29L592.6 344ZM965 221.15L1218 170L1235.6 214L982.6 265.15Z", x: 720, y: 208, range: ["2", 10, 20], secondaryLabels: [{x: 1080, y: 134, text: "NIK"}, {x: 752, y: 289, text: "NIK"}, {x: 1112, y: 215, text: "NIK"}]},
  {id: "2-ekik", floor: "2", name: "Egyetemi Kutató és Információs Központ", code: "2.21–2.36", short: "EKIK", kind: "research", path: "M155 703H422V849H274V789H155ZM536 735H624V783H536ZM536 799H608V849H536Z", x: 300, y: 753, range: ["2", 21, 36], secondaryLabels: [{x: 580, y: 759, text: "EKIK"}, {x: 572, y: 824, text: "EKIK"}], note: "A táblán az alsó szárnyhoz tartozó EKIK-terület; saját frontoldali lépcső/lift maggal."},
  {id: "2-ekik-office", floor: "2", name: "EKIK főigazgatói iroda", short: "Főig.", kind: "office", path: "M614 799H684V849H614Z", x: 649, y: 824, tone: "research", note: "A főigazgatói iroda a táblán az alsó keleti EKIK-csoport szélső helyiségében szerepel."},
  {id: "2-wc", floor: "2", name: "Mosdó", short: "WC", kind: "service", x: 482.5, y: 382, path: "M460 365H505V399H460Z"},
  {id: "2-stairs", floor: "2", name: "Északi lépcső", short: "L", kind: "circulation", x: 889, y: 166, symbol: "stairs", rotation: 78.5},
  {id: "2-lift", floor: "2", name: "Északi felvonó", short: "Lift", kind: "circulation", x: 913, y: 190},
  {id: "2-rector-office", floor: "2", name: "Rektor", short: "Rektor", kind: "office", x: 340, y: 296.5, path: "M273 270H405V323H273Z"},
  {id: "2-west-lift", floor: "2", name: "Nyugati felvonó", short: "Lift", kind: "circulation", x: 450, y: 300},
  {id: "2-west-stairs", floor: "2", name: "Nyugati lépcső", short: "L", kind: "circulation", x: 420, y: 300, symbol: "stairs", rotation: 90},
  {id: "2-hall-lift", floor: "2", name: "Felvonó a nyugati közlekedőnél", short: "Lift", kind: "circulation", x: 522, y: 372},
  {id: "2-front-lift", floor: "2", name: "Frontoldali felvonó", short: "Lift", kind: "circulation", x: 490, y: 755},
  {id: "2-front-stairs", floor: "2", name: "Frontoldali lépcső", short: "L", kind: "circulation", x: 448, y: 780, symbol: "stairs", rotation: 270},
  {id: "2-front-wc", floor: "2", name: "Frontoldali mosdó", short: "WC", kind: "service", x: 460, y: 712, path: "M430 697H490V727H430Z"},
  {id: "2-north-wc", rotation: -11.43, labelFontSize: 11, floor: "2", name: "Északi mosdó", short: "WC", kind: "service", x: 943.5, y: 257.5, path: "M923 246L952 240L964 269L935 275Z"},

  {id: "3-nik", rotation: -11.43, floor: "3", name: "NIK intézeti terület", code: "3.01–3.28", short: "NIK", kind: "research", tone: "teaching", path: "M543 220L868 154.29L884.8 196.29L559.8 262ZM933 141.15L1186 90L1202.8 132L949.8 183.15ZM575 300L900 234.29L917.6 278.29L592.6 344ZM965 221.15L1218 170L1235.6 214L982.6 265.15Z", x: 720, y: 208, range: ["3", 1, 28], secondaryLabels: [{x: 1080, y: 134, text: "NIK"}, {x: 752, y: 289, text: "NIK"}, {x: 1112, y: 215, text: "NIK"}], note: "A tábla a Biomatika és Alkalmazott Mesterséges Intelligencia, a Kiberfizikai Rendszerek, valamint a Szoftvertervezés és Fejlesztés intézeteit jelöli ezen a szinten. A pontos szobabeosztás nem látszik."},
  {id: "3-wc", rotation: -11.43, labelFontSize: 11, floor: "3", name: "Északi mosdó", short: "WC", kind: "service", x: 943.5, y: 257.5, path: "M923 246L952 240L964 269L935 275Z"},
  {id: "3-stairs", floor: "3", name: "Északi lépcső", short: "L", kind: "circulation", x: 889, y: 166, symbol: "stairs", rotation: 78.5},
  {id: "3-lift", floor: "3", name: "Északi felvonó", short: "Lift", kind: "circulation", x: 913, y: 190},

  {id: "4-dean", rotation: -11.43, floor: "4", name: "Dékáni hivatal", short: "Dékáni hivatal", kind: "office", tone: "teaching", path: "M933 141.15L1186 90L1202.8 132L949.8 183.15Z", x: 1080, y: 138},
  {id: "4-meeting", rotation: -11.43, floor: "4", name: "Dékáni tanácsterem", code: "4.01", short: "4.01", kind: "office", tone: "teaching", path: "M543 220L673 193.72L689.8 235.72L559.8 262Z", x: 615, y: 227},
  {id: "4-nik", rotation: -11.43, floor: "4", name: "Neumann János Informatikai Kar", code: "4.02–4.28", short: "NIK", kind: "office", tone: "teaching", path: "M680 192.3L868 154.29L884.8 196.29L696.8 234.3ZM575 300L900 234.29L917.6 278.29L592.6 344ZM965 221.15L1218 170L1235.6 214L982.6 265.15Z", x: 780, y: 193, range: ["4", 2, 28], secondaryLabels: [{x: 752, y: 289, text: "NIK"}, {x: 1112, y: 215, text: "NIK"}], note: "A tábla az Alkalmazott Matematikai Intézetet is itt jelöli; a pontos szobahatárok nem látszanak."},
  {id: "4-wc", rotation: -11.43, labelFontSize: 11, floor: "4", name: "Északi mosdó", short: "WC", kind: "service", x: 943.5, y: 257.5, path: "M923 246L952 240L964 269L935 275Z"},
  {id: "4-stairs", floor: "4", name: "Északi lépcső", short: "L", kind: "circulation", x: 889, y: 166, symbol: "stairs", rotation: 78.5},
  {id: "4-lift", floor: "4", name: "Északi felvonó", short: "Lift", kind: "circulation", x: 913, y: 190},
];

export interface FloorShape {
  viewBox: [number, number, number, number];
  shell: string;
  corridor: string;
  insets?: string;
}

export const FLOOR_SHAPES: Record<FloorId, FloorShape> = {
  "A": {viewBox: [90, 225, 775, 705], shell: "M118 255H550V333H817V718H712V891H262V735H118Z", corridor: "M274 718H495V750H615V860H274Z M405 400H550V447H405Z"},
  "F": {viewBox: [0, 0, 1500, 930], shell: "M118 255H410V270L563 204L1186 90L1235 214L1107 240V447H684V479H711C772 479 805 521 805 575C805 630.5 772 671 711 671H684V703H684V860H536V735H466V860H274V801H143V703H118Z", corridor: "M543 305L1082 193L1100 236L553 350H410V306H543ZM118 430H430V703H118ZM267 703H684V735H267ZM427 731H466V855H427Z"},
  "1": {viewBox: [90, 55, 1185, 850], shell: "M543 220L1186 90L1235.6 214L592.6 344Z M132 270H480L543 220L592.6 344L535 365V410H405V426H132Z M470 365H535C540 440 555 470 580 490L555 530C520 494 511 461 505 430L505 703H430V670L455 470Z M505 430C540 450 555 470 580 490C560 515 550 545 550 575C550 605 560 635 580 660C555 675 530 690 505 703Z M540 575C540 500 600 463 690 463C785 463 845 505 845 575C845 645 785 687 690 687C600 687 540 650 540 575Z M595 447H655V491H595Z M595 665H655V735H595Z M143 691H636V787H696V861H536V861H274V801H143Z", corridor: "M559.8 262L1202.8 132L1218 170L575 300ZM868 154.29L933 141.15L982.6 265.15L917.6 278.29Z M132 323H468L559.8 262L575 300L505 363H132Z M470 365H535C540 440 555 470 580 490L555 530C520 494 511 461 505 430L505 703H430V670L455 470Z M505 430C540 450 555 470 580 490C560 515 550 545 550 575C550 605 560 635 580 660C555 675 530 690 505 703Z M422 691H636V735H524V783H696V799H524V861H430V849H422Z M595 447H655V491H595Z M595 665H655V735H595Z"},
  "2": {viewBox: [90, 55, 1185, 850], shell: "M543 220L1186 90L1235.6 214L592.6 344Z M132 270H480L543 220L592.6 344L535 365V410H405V426H132Z M143 691H636V787H696V861H536V861H274V801H143Z", corridor: "M559.8 262L1202.8 132L1218 170L575 300ZM868 154.29L933 141.15L982.6 265.15L917.6 278.29Z M132 323H468L559.8 262L575 300L505 363H132Z M422 691H636V735H524V783H696V799H524V861H430V849H422Z", insets: "M974.2 190.11L1066.2 171.51L1072.2 186.51L980.2 205.11ZM1085.2 167.67L1189.2 146.64L1195.2 161.64L1091.2 182.67Z"},
  "3": {viewBox: [505, 55, 780, 330], shell: "M543 220L1186 90L1235.6 214L592.6 344Z", corridor: "M559.8 262L1202.8 132L1218 170L575 300ZM868 154.29L933 141.15L982.6 265.15L917.6 278.29Z", insets: "M974.2 190.11L1066.2 171.51L1072.2 186.51L980.2 205.11ZM1085.2 167.67L1189.2 146.64L1195.2 161.64L1091.2 182.67Z"},
  "4": {viewBox: [505, 55, 780, 330], shell: "M543 220L1186 90L1235.6 214L592.6 344Z", corridor: "M559.8 262L1202.8 132L1218 170L575 300ZM868 154.29L933 141.15L982.6 265.15L917.6 278.29Z", insets: "M974.2 190.11L1066.2 171.51L1072.2 186.51L980.2 205.11ZM1085.2 167.67L1189.2 146.64L1195.2 161.64L1091.2 182.67Z"},
};
