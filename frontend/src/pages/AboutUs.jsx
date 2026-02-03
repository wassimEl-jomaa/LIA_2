import { Link } from "react-router-dom";

export default function AboutUs() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-white/80 border border-slate-200 shadow-sm p-8">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-300/30 to-indigo-300/30 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-emerald-300/30 to-cyan-300/30 blur-2xl" />

          <div className="relative space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              AI Test Assistant
            </h1>
            <p className="max-w-2xl text-base text-slate-600">
              Ett LIA-projekt som utforskar hur artificiell intelligens kan
              effektivisera mjukvarutestning och kvalitetssäkring.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">
                LIA-projekt
              </span>
              <span className="rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-semibold">
                AI & QA
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
                React + Tailwind
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="grid gap-4 text-slate-700 leading-relaxed">
          <p>
            AI Test Assistant är ett projekt som undersöker hur AI kan användas
            för att stödja och förbättra testarbete genom hela
            utvecklingsprocessen.
          </p>

          <p>
            Lösningen riktar sig till testare, testledare och QA-team och syftar
            till att minska manuellt arbete genom att automatisera delar av
            testprocessen – exempelvis skapande av testfall, riskanalys och
            sammanfattning av testresultat.
          </p>

          <p>
            Genom att kombinera moderna webbramverk med AI och språkteknologi
            skapas ett intelligent stöd som bidrar till bättre testtäckning,
            högre kvalitet och bättre beslutsfattande.
          </p>
        </div>

        {/* Goals + Tech */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-blue-800 mb-3">
              Projektets mål
            </h2>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Effektivisera test- och QA-arbete</li>
              <li>Minska repetitiva manuella uppgifter</li>
              <li>Stödja riskbaserad och datadriven testning</li>
              <li>Visa praktisk användning av AI inom testning</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-blue-800 mb-3">
              Om tekniken
            </h2>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Frontend byggd med React och Tailwind CSS</li>
              <li>Backend med Node.js och Express</li>
              <li>AI-baserad textanalys för krav, tester och buggrapporter</li>
              <li>REST-API för kommunikation mellan frontend och backend</li>
            </ul>
          </div>
        </div>

        {/* Developer */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="text-lg font-bold text-indigo-900 mb-2">
            Om utvecklaren
          </h2>
          <p className="text-sm text-indigo-900/80">
            Projektet är utvecklat som en del av LIA-perioden av
            <strong> Wasim El-jomaa</strong> i samarbete med
            <strong> Noor Engineering AB (559036-2686)</strong>.
          </p>
        </div>

        {/* Footer link (optional) */}
        <div className="pt-2">
          <Link
            to="/"
            className="text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            ← Tillbaka till startsidan
          </Link>
        </div>
      </div>
    </div>
  );
}
