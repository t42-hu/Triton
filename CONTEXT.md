# Egyetemi órarend

Helyben tárolt személyes órarendek kezelése és összehasonlítása. A fogalmak minden profilban ugyanazt jelentik.

## Fogalmak

**Profil**: Egy elnevezett személy órarendje, egy importforrással és tetszőleges kézi órákkal.
_Kerülendő_: fiók, bejelentkezett felhasználó.

**Saját profil**: A felhasználó által sajátjaként megjelölt profil; egyszerre legfeljebb egy lehet ilyen.

**Importforrás**: Egy profil cserélhető, eredeti naptártartalma. Az új fájl ugyanazt a forráshelyet foglalja el.
_Kerülendő_: új profil, szinkronizált fiók.

**Órasorozat**: Egy névvel és ismétlődési szabállyal meghatározott óra véges vagy a választott időszakra kibontott alkalmai.

**Alkalom**: Egy esemény egy konkrét előfordulása. Áthelyezése nem változtatja meg az eredeti előforduláshoz tartozó azonosságát.
_Kerülendő_: naphoz kötött másolat.

**Felülírás**: Egy alkalom jóváhagyott helyi mezőmódosítása, amely a forrás megfelelő mezőjénél elsőbbséget élvez.

**Tartós módosítás**: A felhasználó által kiválasztott, már ismert jövőbeli alkalmak felülírása. Nem jelent automatikusan öröklődő szabályt.

**Elrejtés**: Egy alkalom visszavonható kihagyása az órarendből és a közösórakeresésből.
_Kerülendő_: forrásból törlés.

**Importtartomány**: Az az időszak, amelynek alkalmai az eredeti forrásból rendelkezésre állnak. Nem azonos a képernyőn éppen látható időszakkal.

**Referenciahét**: A közös hétfői dátum és A/B jel, amelyhez minden váltakozó kézi és JSON-óra igazodik.

**Közös óra**: Két profil nem elrejtett alkalma azonos látható névvel, kezdéssel, befejezéssel és azonos, megadott teremmel.
