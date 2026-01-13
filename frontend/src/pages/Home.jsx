import { Link } from "react-router-dom";
export default function Home() {
  return (
    <div className="grid gap-8">
      {/* Intro */}
      <section>
        <h1 className="text-3xl font-bold text-blue-800 mb-3">
          🤖 AI-assistent för testning & kvalitetssäkring
        </h1>
        <p className="text-slate-600 max-w-3xl">
          En intern och kundanpassad AI-assistent som stödjer testare och
          testledare i arbetet med testning och kvalitetssäkring av mjukvara.
          Projektet fokuserar på att effektivisera testprocesser, minska manuellt
          arbete och höja den övergripande kvaliteten med hjälp av AI.
        </p>
      </section>

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold text-blue-800 mb-2">
          🎯 Syfte
        </h2>
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>Snabbare skapa relevanta testfall</li>
          <li>Identifiera risker tidigt i testfasen</li>
          <li>Säkerställa stabilitet vid kodändringar</li>
          <li>Förbättra överblick och beslutsfattande</li>
        </ul>
        <Link
  to="/testcases"
  className="mt-4 inline-flex items-center rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-600 transition"
>
  🚀 Starta – Skapa testfall
</Link>
      </section>

      {/* Features */}
      <section>
        <h2 className="text-xl font-semibold text-blue-800 mb-3">
          🚀 Funktioner
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-800">
              Generering av testfall från krav
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Automatiskt omvandla kravspecifikationer till strukturerade
              testfall.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-800">
              Identifiering av riskområden
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Analys av krav, kodändringar och historiska buggar för att
              prioritera testning.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-800">
              Förslag på regressionstester
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Rekommendationer på vilka tester som bör köras vid ändringar i
              koden.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-800">
              Sammanfattning av testresultat
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Tydliga och lättförståeliga sammanfattningar för testledning och
              team.
            </p>
          </div>
        </div>
      </section>

      {/* Target group */}
      <section>
        <h2 className="text-xl font-semibold text-blue-800 mb-2">
          🧠 Målgrupp
        </h2>
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>Testare</li>
          <li>Testledare</li>
          <li>QA-team</li>
          <li>Utvecklingsteam</li>
          <li>
            Organisationer som vill arbeta mer datadrivet med
            kvalitetssäkring
          </li>
        </ul>
      </section>

      {/* Technology */}
      <section>
        <h2 className="text-xl font-semibold text-blue-800 mb-2">
          🛠️ Teknik (exempel)
        </h2>
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>AI / NLP för analys av krav, tester och buggrapporter</li>
          <li>Integration med test- och ärendehanteringsverktyg</li>
          <li>Anpassningsbar för interna och kundspecifika behov</li>
        </ul>
      </section>

      {/* Benefits */}
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-xl font-semibold text-blue-800 mb-2">
          📈 Förväntad nytta
        </h2>
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>Minskad tid för manuellt testarbete</li>
          <li>Förbättrad testtäckning och kvalitet</li>
          <li>Bättre prioritering av testinsatser</li>
          <li>Tydligare kommunikation mellan team</li>
        </ul>
      </section>
    </div>
  );
}
