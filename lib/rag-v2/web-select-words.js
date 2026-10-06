// Word lists for the choice of an organisation's pages (web-select.js).

// Given names in use in Estonia: a capitalised word after one of these is taken for a family name. The list is a
// word list like a dictionary's, written out by hand; it names no one.
export const GIVEN_NAMES = new Set(`
Aadu Aare Aarne Aavo Ado Ago Ahti Ahto Aigar Ain Aimar Aivar Aivo Alar Alari Albert Aleks Aleksander Aleksandr Aleksei Alfred Allan Allar Alo Alvar Anatoli Ander Andero Ando Andre
Andreas Andrei Andres Andri Andrus Anti Anto Anton Ants Ardi Ardo Argo Arles Armin Arne Arno Arnold Aro Artjom Artur Arved Arvi Arvo Asko Assar Ats August Aulis Avo Boriss Daniel
David Denis Dmitri Eduard Eerik Eero Egert Egon Einar Eino Elmar Elmo Endel Enn Enno Erik Erki Erkki Erko Ermo Ervin Esko Evald Evert Feliks Fjodor Fred Gennadi Georg Gert Gunnar
Guido Gustav Hando Hannes Hanno Hans Hardi Hardo Harald Harri Harry Heigo Heiki Heikki Heino Heiti Helmut Hendrik Henn Henri Henrik Henry Herbert Herman Hillar Hugo Igor Ilmar Imre
Indrek Innar Ivan Ivar Ivo Jaagup Jaak Jaan Jaanus Jakob Jan Janar Janek Janno Jarmo Jevgeni Joel Johan Johannes Joonas Joosep Juhan Juhani Julius Juri Jüri Kaarel Kaido Kaimar Kait
Kalev Kalju Kalle Kalmer Karl Karmo Kaspar Kaupo Keijo Kert Kevin Kirill Koit Konstantin Kristen Kristjan Kristo Kristofer Kuldar Kunnar Kustas Kuno Lauri Leho Lembit Lennart Leo
Leonid Madis Magnus Maido Mairo Mait Maksim Marek Margo Margus Mario Mark Marko Markus Mart Marten Martin Mati Mats Mattias Meelis Mehis Mihhail Mihkel Mikk Märt Neeme Nikita Nikolai
Oleg Olev Oliver Oskar Ott Otto Paavo Paul Pavel Peep Peeter Pjotr Priidu Priit Ragnar Raido Raigo Rain Rainer Rait Raivo Rando Rasmus Raul Rauno Reigo Reimo Rein Reio Renee Richard
Riho Risto Robert Robin Roland Roman Romet Rudolf Ruslan Sander Sergei Siim Silver Simmo Stanislav Sten Sulev Sven Taavi Tanel Tarmo Tarvo Tauno Teet Tiit Timo Toivo Tom Tommi Toomas
Tõnis Tõnu Uku Uno Urmas Urmo Vadim Vahur Vaino Valdek Valdo Valdur Valeri Valter Vambola Veiko Vello Verner Viktor Viljar Villem Villu Vitali Vjatšeslav Vladimir Väino Ülo
Aet Age Agne Agnes Aili Aime Aino Aire Airi Aita Aive Alla Alice Aliise Alina Anastassia Anett Angela Angelika Anna Anne Anneli Annely Annemai Anni Annika Antonina Anu Asta Astrid
Ave Avely Birgit Brita Carmen Diana Eda Edith Eevi Eha Eike Elen Eliis Elina Elis Elisabeth Ella Elle Ellen Elo Elsa Else Elve Ene Eneli Epp Erika Erle Ester Eva Eve Eveli Evelin
Evi Galina Gerda Gerli Gerly Greete Grete Hedi Heidi Heidy Heili Helbe Heldi Helen Helena Helga Helgi Heli Helina Helju Helle Helve Hilja Hille Ilme Ilona Ilse Imbi Inga Inge
Ingrid Inna Irina Iris Irja Ivi Ivika Jaana Jaanika Jana Jane Janika Janne Jekaterina Jelena Johanna Julia Juta Kadi Kadri Kai Kaia Kaidi Kaie Kaili Kaire Kairi Kaisa Kaja Karin
Karmen Karoliina Kati Katre Katri Katrin Kelli Kerli Kersti Kerttu Kirke Krista Kristel Kristi Kristiina Kristin Kristina Kätlin Külli Küllike Laine Larissa Laura Lea Leelo Leena
Leida Leili Lembe Lidia Liia Liidia Liina Liis Liisa Liisi Liivi Lilian Lilia Linda Ljubov Ljudmila Loore Luule Lya Maarika Maarja Made Mai Maie Maila Maire Mairi Malle Mare Maret
Margit Margot Mari Maria Mariann Marianne Marika Marina Maris Marje Marju Marta Meeli Meelike Merike Merilin Merle Mia Milvi Mirja Mirjam Moonika Monika Nadežda Natalja Nele Niina
Nina Oksana Olga Piia Pille Piret Ragne Raili Raissa Reelika Reet Riina Rita Ruth Rutt Saima Sandra Signe Sigrid Siiri Sille Silvi Silvia Siret Sirje Sirle Sofia Svetlana Taimi
Tamara Tatjana Tea Terje Tiia Tiina Tiiu Triin Triinu Tuuli Ulvi Urve Valentina Valve Veera Veronika Viivi Viive Viktoria Vilja Vilma Virve Zoja Õie Ülle
`.trim().split(/\s+/u));

// Capitalised word pairs seen on the organisations' pages that are not a person's name (06.10.2026: looked at one
// by one): names of institutions, places of business and events, foreign-language titles, repeated headings, and
// people of history after whom something is named. A pair not listed here whose words are never written in lower
// case in the reading is taken for a name: what the list misses costs a paragraph, not a person's privacy.
export const NOT_PERSONS = new Set(`
Advancing Hard|Akzo Nobel|Alizze Puffy|Andmekaitse Inspektsioon|Andmekaitse Inspektsiooni|Arena Lillestrøm|Asendushooldusteenus Asendushooldusteenuse|Astra Kliinikul|Asume Kristiine
Best Practices|Biotehnoloogia Park|Bonifatiuse Gildi|Consensus Statement|Ehitusprojekt Esplan|Estonian Academy|Etümoloogiliselt Sõnaveeb|European Alliance|European Multiple
European Union|Financial Statements|Googel Playst|Hestia Hotel|Hotel Europa|Ida-Tallinna Keskahigla|Ida-Tallinna Keskhaigla|Ida-Viru Keskhaigla|Industrial Engineering
Inimuuringute Eetikakomiteelt|Invaspordiklubi Parasport|Jaagumäe Söögisaal|Jalgrattasport Jõutõstmine|Kaitseasendid Helid|Kaja Valguse|Valguse Kaja|Kelguhoki Laskesuusatamine
Keskliidu Iirise|Kogukonnasündmus Onkofest|Komisjonipood Võrus|Koristusrütm Kodukeemia|Korterid Mustamäel|Kultuurireis Peipsi|Kõku Klubiks|Kõku Klubile|Kärla Rahvamajja
Laskesuusatamine Murdmaasuusatamine|Lastehaigla Toetusfond|Louis Braille|Lugemisteleviisor Valgustid|Lõuna-Eesti Vähiühing|Lääne-Tallinna Keskhaiglal|Merimetsa Tugikeskus
Merimetsa Tugikeskusele|Metab Res|Murdmaasuusatamine Mäesuusatamine|Mõttekoda Praxis|Nakkushaigused Kopsuinfektsioonid|Neck Surgery|Nimeline Neuroloogide|Nõva Villas
Nägemisvaegurite Arenduskeskus|Närvilibistusharjutused Käeteraapia|Ocean Air|Paralümpiakomitee Tulevased|Plena Inclusión|Plural Publishing|Programming Cochlear|Publishing Inc
Punktkirjaõpetus Masinkirjaõpetus|Rehabilitatsiooniteenused Erihoolekandeteenused|Res Rev|Robert Kochi|Ränduri Pubi|Skota Hem|Soovides Keskusesse|Sotsioloogiliselt Austraalia
Spordieetika Sihtasutuselt|Swedbank Bank|Söögisaal Koidula|Söök Kana|Zonta Klubile|Tagasivaade Euroopa|Talking Birth|Tallinnas Tallink|Teatrikülastus Tartusse
Teavitusmaterjalid Eestikeelsed|Thon Arena|Treeningpõhimõtteid Ohutuspõhimõtteid|Tulemuslikkus Orienteeritus|Union Agency|Varbla Puhkekülasse|Viiratsi Hoolekandekeskuse
Viljandist Jäätise|Villas Läänemaal|Värvipüüdjad Loputusvahend|Õrnpesuaine Pesuaine|Главная Памятка|Herbert Masingu|Ludvig Puusepa|Puusepa Nimeline|Pubi Jüri|Maksimarket Jüri
Südameapteek Jüri|Võrus Jüri|Ait Jüri|Linnavolikogu Jüri|Kannel Liiva|Human Forever|Cyprus League|Frame Running|Spafo Norge|Villa Liisus|Villa Liisu|Töövarjutus Lõuna-Euroopa
Tähtvere Spordipargis|Radisson Blu|Original Sokos|Novo Nordiski|Lege Artis|Karjamaa Puhkebaasis|Guide Running|Forus Tondi|America Toolkit|Понедельник Вторник|Ööbikoru Villa|Vinci Genius
Veskimetsa Ratsabaas|Venture Connect|Variku Spordihoone|Vaimukate Kodukohvikus|Vaimukate Kodukohvik|United Beds|Ujumistreeningud Saaremaal|Töövarjutus Küprose
Tähtvere Tervisespordikeskuses|Tondiraba Jäähallis|Thinking Globally|Tenerife Courses|Tartus Tähtvere|Suomen Kuurosokeat|Stora Enso|Skulptuurinäitus Meelepete|Sitting Volleyball
Self-Care Strategies|Saudi Araabia|Saksa Luterliku|Rannu Pubi|Pärimusmuusika Aidas|Professional Standards|Nõmme Spordikeskuses|Nordic Meetingu|Monday Tuesday|Latvijas Kaulu
Laskesuusatamise Föderatsioon|Küprose Reumahaigete|Kääriku Spordikeskuses|Kullo Lastegaleriis|Kullo Lastegaleriid|Kullo Lastegalerii|Kukrumäe Ratsatalu|Kollanokad Siguldas
Koidula Saun|Kiviõli Seikluskeskuses|Kaunite Kunstide|Kalevi Yacht|Kalevi Poksiklubiga|Jätk Vändra|Jooksusilmade Facebooki|Idevelop Training|Hortus Medicus|Hollandis Haagis
Hispaanias Barcelonas|Gym Linnamäe|European Haemophilia|Estonian Association|Esitlus Veritsushaiguste|Dexcom Eestis|Berlin-Chemie Menarini|Barcelonas Hispaanias
Audioloogiaühingute Föderatsioon|Astagnu Kutserehabilitatsiooni|Asociación Socioeducativa|Arthritis Day|Ahrensburgi Kodanike
`.trim().split(/\s*[|\n]\s*/u));

// Capitalised words that are not a name: the country and its large towns and regions, institutions, the words a
// page's headings and contact lines begin with, days and months. A municipality's and a county's words are added by
// the caller from the municipalities' packages.
export const COMMON_WORDS = new Set(('eesti tallinn tallinna tartu pärnu narva viljandi kuressaare haapsalu rakvere võru valga põlva jõhvi paide rapla kärdla jõgeva harju harjumaa saaremaa hiiumaa '
  + 'läänemaa virumaa ida lääne põhja lõuna euroopa vabariik vabariigi riigi riigikogu valitsus '
  + 'sotsiaalkindlustusamet tervisekassa töötukassa haigekassa sotsiaalministeerium terviseamet rahvusraamatukogu ülikool ülikooli kliinikum haigla regionaalhaigla keskhaigla '
  + 'loe edasi vaata lähemalt meie teie tere tulemast kontakt kontaktid avaleht uudised teenused info telefon aadress email post tel mob faks registrikood arveldusarve swedbank seb lhv luminor '
  + 'esmaspäev teisipäev kolmapäev neljapäev reede laupäev pühapäev jaanuar veebruar märts aprill mai juuni juuli august september oktoober november detsember '
  + 'mtü sihtasutus osaühing aktsiaselts kogu kõik iga uus hea suur väike kui kes mis kus millal miks kuidas see need tema nad').split(/\s+/u));
// A word that ends like the name of an organisation, a place or a thing.
export const THING_ENDING = /(?:liit|liidu|koda|koja|ühing|ühingu|ühendus|ühenduse|selts|seltsi|keskus|keskuse|fond|fondi|amet|ameti|kassa|valitsus|valitsuse|haigla|kliinik|kool|kooli|maja|nõukoda|nõukoja|maakond|maakonna|vald|valla|linn|linna|tänav|tee|maantee|väljak|komitee|ministeerium|teenus|teenused|rühm|grupp|klubi|päev|päevad|kuu|aasta|programm|projekt|haigus|tõbi|sündroom|puue|ravi)$/u;
