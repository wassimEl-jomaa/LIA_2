# 🤖 AI-assistent för testning & kvalitetssäkring

En intern och kundanpassad AI-assistent som stödjer testare och testledare i arbetet med testning och kvalitetssäkring av mjukvara. Projektet fokuserar på att effektivisera testprocesser, minska manuellt arbete och höja den övergripande kvaliteten med hjälp av AI.

## 🎯 Syfte

Syftet med projektet är att skapa ett intelligent stöd som hjälper team att:
- Snabbare skapa relevanta testfall
- Identifiera risker tidigt i testfasen
- Säkerställa stabilitet vid kodändringar
- Förbättra överblick och beslutsfattande

## 🚀 Funktioner

- **Generering av testfall från krav**  
  Automatiskt omvandla kravspecifikationer till strukturerade testfall.

- **Identifiering av riskområden**  
  Analys av krav, kodändringar och historiska buggar för att prioritera testning.

- **Förslag på regressionstester**  
  Rekommendationer på vilka tester som bör köras vid ändringar i koden.

- **Sammanfattning av testresultat och buggrapporter**  
  Tydliga och lättförståeliga sammanfattningar för testledning och team.

## 🧠 Målgrupp

- Testare
- Testledare
- QA-team
- Utvecklingsteam
- Organisationer som vill arbeta mer datadrivet med kvalitetssäkring

## 🛠️ Teknik (exempel)

- AI / NLP för analys av krav, tester och buggrapporter
- Integration med test- och ärendehanteringsverktyg
- Anpassningsbar för interna och kundspecifika behov

## 📈 Förväntad nytta

- Minskad tid för manuellt testarbete
- Förbättrad testtäckning och kvalitet
- Bättre prioritering av testinsatser
- Tydligare kommunikation mellan team

## 📄 Status

Projektet är under utveckling och vidareutvecklas kontinuerligt.


### Navigate to backend directory
cd backend

### Create and activate virtual environment
python -m venv .venv
source .venv/Scripts/activate  # Windows (Git Bash)
# OR
.venv\Scripts\activate  # Windows (CMD/PowerShell)

### Install dependencies
pip install -r requirements.txt  

### Create database tables
# Option 1: Use Python script (recommended - easier)
python create_tables.py

# Option 2: Use SQL scripts directly with PostgreSQL client
cd sql_scripts
psql -U postgres -d noor_ai_assistant -f create_bug_status_history.sql
psql -U postgres -d noor_ai_assistant -f create_bug_retests.sql
cd ..

### Start the FastAPI server

### Open in browser
👉 http://127.0.0.1:8000/docs

Use the interactive Swagger UI to test endpoints.

Add your own OpenAI API key via environment variables or a `.env` file; do not commit secrets to version control.