import { LegalDoc } from './types';

export const sqLegal: Record<'terms' | 'privacy', LegalDoc> = {
  terms: {
    title: 'Kushtet e përdorimit',
    updated: '30 tetor 2026',
    sections: [
      {
        heading: 'Shërbimi',
        body: 'Ky sit është një tavolinë e pavarur, jozyrtare, e lojës tradicionale shqiptare që njihet si Murlan (edhe si Pass). Rregullat e asaj loje popullore janë traditë e përbashkët. Nuk i zotëron ky sit as ndonjë app tjetër. Nuk ka tarifë hyrjeje, depozita, tërheqje parash as çmime në botën reale. Nuk është bixhoz.',
      },
      {
        heading: 'Jo app-et e tjerë',
        body: 'Ky projekt nuk është Murlan Cards, Murlan Pro, MURLAN nga TRIV.AL, murlan.app, as ndonjë produkt tjetër komercial Murlan. Nuk është i lidhur, i aprovuar, as zëvendësues i atyre app-eve ose botuesve të tyre. Nuk përdorim logot, artin e kartave, kodin ose listimet e tyre. Nëse ke shkarkuar një Murlan tjetër nga App Store ose Google Play, ai është produkt i veçantë.',
      },
      {
        heading: 'Kush mund ta përdorë',
        body: 'Duhet të jesh të paktën 13 vjeç. Nëse je nën 18 vjeç, një prind ose kujdestar duhet t’i lexojë këto kushte me ty. Mos e përdor app-in nëse nuk i pranon.',
      },
      {
        heading: 'Llogaria dhe emri',
        body: 'Luaj me një emër të trilluar. Mos përdor emrin tënd të vërtetë, adresën, telefonin, shkollën ose të dhëna të tjera personale si emër ose në bisedë. Ti je përgjegjës për çfarë shkruan, thua dhe ngarkon në pajisjen tënde.',
      },
      {
        heading: 'Biseda, zëri dhe fotot',
        body: 'Biseda e tavolinës, zëri dhe foto e profilit janë opsionale. Të tjerët në tavolinë i dëgjojnë dhe i shohin. Mos ndaj përmbajtje të paligjshme, urrejtje, materiale seksuale me të mitur, ngacmim ose shkelje të drejtave. Mund të boshatisim tavolinën, të heshtim një vend, të fshijmë bisedën ose të mbyllim lojën. Zëri shkon live te tavolina dhe nuk ruhet si incizim. Biseda ruhet vetëm sa tavolina është aktive dhe fshihet kur loja mbaron.',
      },
      {
        heading: 'Lojë e ndershme',
        body: 'Mos hile, mos sulmo shërbimin, mos u paraqit si tjetërkush, mos merr llogari të huaja dhe mos provo të lexosh kartat e fshehura. Serveri vendos kartat, pikët dhe nëse një lojë lejohet. Rezultati, shkëputjet dhe veprimet e adminit (përfshi mbylljen e tavolinës) janë përfundimtare për programin. Mosmarrëveshjet mes lojtarëve i zgjidhni ju.',
      },
      {
        heading: 'Siç është',
        body: 'App-i jepet siç është, pa garanci, përfshi qëllimin e caktuar, punimin pa ndërprerje ose lojë pa gabime. Hostimi, rrjeti yt dhe shfletuesi mund të dështojnë. Mund ta ndryshojmë, ta ndalim përkohësisht ose ta mbyllim shërbimin në çdo kohë.',
      },
      {
        heading: 'Kufizimi i përgjegjësisë',
        body: 'Në masën më të madhe që lejon ligji, operatori i Murlan nuk përgjigjet për lojëra të humbura, të dhëna të humbura, fyerje në bisedë ose zë, lidhje të humbura, probleme të pajisjes, as dëme të tërthorta. Përdor një app argëtimi falas. Nëse një gjykatë e gjen këtë kufi të pazbatueshëm, përgjegjësia kufizohet te shuma që na ke paguar për app-in në 12 muajt e fundit, që është zero.',
      },
      {
        heading: 'Përgjegjësia jote',
        body: 'Pranon të mbrosh operatorin nga kërkesat që lindin nga përmbajtja jote, keqpërdorimi i app-it ose shkelja e këtyre kushteve, përveç rasteve kur ligji nuk e lejon.',
      },
      {
        heading: 'Ndryshimet',
        body: 'Mund t’i përditësojmë këto kushte. Versioni në app është ai aktual. Nëse ndryshon numri i versionit, do të të kërkohet t’i pranosh sërish para lojës.',
      },
    ],
  },
  privacy: {
    title: 'Politika e privatësisë',
    updated: '30 tetor 2026',
    sections: [
      {
        heading: 'Çfarë ruan app-i',
        body: 'Për tavolinën ruajmë një llogari mysafiri: emër, avatar opsional, fitore/humbje, shokë, dhe një hash njëkahësh të një sekreti që mbetet te pajisja jote. Nuk mbledhim emrin ligjor, karta pagese as dokumente. Mos i vendos ato në bisedë ose te emri.',
      },
      {
        heading: 'Te pajisja jote',
        body: 'Pajisja ruan sekretin e identitetit, tokenin e sesionit, cilësimet, gjuhën dhe foton e profilit nëse e zgjedh. Fotot nuk ngarkohen te serveri i lojës.',
      },
      {
        heading: 'Gjatë lojës',
        body: 'Lojtarët e ulur shohin emrat, kartat publike, pikët dhe bisedën. Zëri shkon te vendet e tjera të tavolinës kur e ndez. Zëri nuk arkivohet. Biseda ruhet vetëm për atë tavolinë dhe fshihet kur loja mbaron.',
      },
      {
        heading: 'Hostimi',
        body: 'Serveri dhe baza e të dhënave punojnë te ofruesit tanë të hostimit që app-i të funksionojë. Ata i përpunojnë të dhënat vetëm për ta mbajtur shërbimin. Nuk i shesim të dhënat dhe nuk i përdorim për profile reklamash.',
      },
      {
        heading: 'Fëmijët',
        body: 'App-i nuk drejtohet te fëmijët nën 13 vjeç. Nuk mbajmë me dijeni llogari për ta. Nëse beson se kemi, ndalo përdorimin dhe njoftó operatorin që llogaria mysafire të hiqet.',
      },
      {
        heading: 'Sa kohë',
        body: 'Statistikat dhe shokët rrinë sa ekziston llogaria. Biseda mbaron me tavolinën. Mund ta lësh app-in kur të duash. Pastrimi i të dhënave të sitit te pajisja heq sekretin lokal; rreshti mysafir në server mund të mbetet derisa të pastrohet si i papërdorur.',
      },
      {
        heading: 'Kërkesat',
        body: 'Kjo është një lojë e vogël falas. Për qasje ose fshirje, kontakto operatorin e këtij siti Murlan. Do të bëjmë çfarë kërkon ligji dhe çfarë lejon sistemi.',
      },
    ],
  },
};
