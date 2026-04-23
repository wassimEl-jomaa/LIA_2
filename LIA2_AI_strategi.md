# Enkel strategi för AI-användning på LIA-företaget

## 1. Syfte med strategin
Syftet med denna strategi är att visa hur företaget på ett enkelt, stegvis och affärsnyttigt sätt kan använda AI för att stärka sin verksamhet. Fokus ligger inte på att ersätta människor, utan på att ge testare, testledare och utvecklingsteam bättre beslutsstöd, minska manuellt arbete och höja kvaliteten i leveranserna.

Målet är att börja i liten skala med lösningar som är realistiska att testa under en pilotperiod och som kan ge tydlig nytta på kort sikt.

## 2. Kort beskrivning av verksamheten och huvudprocesser
Företaget arbetar med testning, kvalitetssäkring och stöd till mjukvaruutveckling. En viktig del av verksamheten är att hantera krav, skapa testfall, genomföra tester, registrera buggar samt följa upp kvalitet och status i projekt.

De huvudsakliga arbetsprocesserna kan sammanfattas så här:
- ta emot och tolka krav eller förändringsönskemål
- planera testarbete och skriva testfall
- genomföra manuella eller semiautomatiska tester
- rapportera, följa upp och retesta buggar
- sammanställa resultat till projektledning, kund eller andra beslutsfattare

Det är i dessa informationsintensiva och återkommande moment som AI kan bidra mest.

## 3. Områden där AI eller maskininlärning kan bidra

### Exempel 1: AI-stöd för generering av testfall och riskanalys
AI kan användas för att analysera kravtexter och föreslå relevanta testfall, riskområden och viktiga gränsfall. I dag görs detta ofta manuellt och kan ta mycket tid, särskilt när dokumentation är omfattande eller otydlig.

**Nytta:**
- snabbare start i testarbetet
- bättre struktur i testfallen
- större chans att upptäcka risker tidigt
- mindre beroende av att varje individ själv ska formulera allt från grunden

### Exempel 2: AI-stöd för regressionstestning och sammanfattning av resultat
AI kan också användas för att föreslå vilka regressionstester som bör prioriteras efter kodändringar samt sammanfatta testresultat och buggrapporter i ett mer lättillgängligt format.

**Nytta:**
- bättre prioritering av vad som ska testas först
- kortare tid för analys och rapportering
- tydligare beslutsunderlag för testledare och projektledning
- minskad risk att viktiga förändringar missas

## 4. Hur lösningarna kan se ut
En enkel lösning är att införa ett internt AI-stöd i företagets befintliga testprocess. Det kan exempelvis vara ett webbgränssnitt där användaren:
- klistrar in ett krav och får förslag på testfall
- får en automatisk riskbedömning
- får rekommendationer om regressionstester vid förändringar
- kan skapa sammanfattningar av testresultat och buggrapporter

Tekniskt kan detta byggas med en kombination av:
- språkmodeller för att analysera text och formulera förslag
- enklare maskininlärning för klassificering och prioritering
- integration mot företagets interna data, till exempel krav, bugghistorik och testresultat

Det viktiga är att AI:n fungerar som ett stöd för människan, inte som en helt självständig beslutsfattare.

## 5. Områden där AI inte bör prioriteras i dagsläget

### Exempel 1: Slutgiltiga kvalitetsbeslut
AI bör inte ensam avgöra om en leverans är redo att gå till kund eller produktion. Den typen av beslut kräver erfarenhet, helhetsbedömning och ansvarstagande som fortfarande behöver ligga hos människor.

**Varför nyttan är begränsad:**
- hög risk om AI gör felbedömningar
- svårt att fånga affärsmässiga och mänskliga aspekter
- ansvarsfrågan måste vara tydlig

### Exempel 2: Avancerade prognoser utan tillräcklig data
Det är heller inte lämpligt att i nuläget satsa stort på avancerade ML-modeller för att förutsäga exempelvis projekttider, kundbeteenden eller framtida felmönster om datamängden är liten eller ojämn.

**Varför nyttan är begränsad:**
- låg träffsäkerhet om underlaget är svagt
- stor risk att lägga tid på teknik som inte ger praktiskt värde
- enklare analys och visualisering kan ofta räcka bättre i ett tidigt skede

## 6. Uppskattat resursbehov
För ett första pilotprojekt bedöms resursbehovet vara relativt begränsat.

### Tid
- förstudie och behovsanalys: 1–2 veckor
- utveckling av enkel pilot: 4–6 veckor
- testning, utvärdering och justering: 2–4 veckor

Totalt: cirka 2–3 månader för en första fungerande pilot.

### Teknisk utrustning
- vanliga utvecklardatorer
- tillgång till molntjänst eller servermiljö
- API-tillgång till AI-tjänst eller lokal modell
- lagring av testdata, krav och historik

### Kompetens
- AI-/ML-kompetens för att välja och anpassa lösning
- systemutvecklare för integration i befintligt system
- domänkompetens från testledare eller QA-personal
- viss kunskap om informationssäkerhet och dataskydd

## 7. Riskhantering, begränsningar och förutsättningar
Det finns flera viktiga risker och begränsningar som måste hanteras.

### Risker och begränsningar
- AI kan ge felaktiga eller alltför generella svar
- känslig information kan hanteras på ett olämpligt sätt om dataskydd saknas
- användare kan få för höga förväntningar på vad AI klarar
- kvaliteten blir beroende av hur bra indata och historik företaget har

### Förslag på hantering
- införa människa i loopen, där alla AI-förslag granskas innan de används
- börja med ett begränsat pilotområde där nyttan är lätt att mäta
- anonymisera eller begränsa känslig data
- ta fram enkla riktlinjer för hur AI får användas i verksamheten
- följa upp effekter i form av tidsbesparing, kvalitet och användarnöjdhet

### Förutsättningar för att lyckas
För att strategin ska fungera krävs:
- tydligt stöd från ansvariga chefer eller projektledning
- tillgång till relevanta arbetsdata
- medarbetare som får tid att testa och ge återkoppling
- ett stegvis införande där teknikens nytta prövas i praktiken

## 8. Sammanfattning
Min bedömning är att företaget har goda möjligheter att använda AI på ett relevant sätt, framför allt som stöd i testning, riskanalys och sammanställning av resultat. Det är områden där mycket tid i dag läggs på manuellt, repetitivt och textbaserat arbete.

Samtidigt bör företaget vara försiktigt med att ge AI för stort ansvar i kritiska beslut eller satsa på alltför avancerade modeller innan datagrunden är tillräckligt stark. En enkel pilot med tydligt avgränsat syfte är därför den mest rimliga vägen framåt.
