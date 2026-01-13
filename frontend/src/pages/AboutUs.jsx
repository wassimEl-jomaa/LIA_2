import { Link } from "react-router-dom";

export default function AboutUs() {
  return (
    <div className="grid gap-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-blue-800">
        Om AI Test Assistant
      </h1>

      <p className="text-slate-700">
        AI Test Assistant är ett LIA-projekt (Lärande i Arbete) som undersöker hur
        artificiell intelligens kan användas för att stödja och förbättra
        mjukvarutestning och kvalitetssäkring.
      </p>

      <p className="text-slate-700">
        Projektet riktar sig till testare, testledare och QA-team och syftar till
        att minska manuellt arbete genom att automatisera delar av testprocessen,
        såsom skapande av testfall, analys av risker och sammanfattning av
        testresultat.
      </p>

      <p className="text-slate-700">
        Genom att kombinera moderna webbramverk med AI och språkteknologi skapas
        ett intelligent stöd som bidrar till bättre testtäckning, högre kvalitet
        och bättre beslutsfattande i utvecklingsprojekt.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-blue-800 mb-2">
          Projektets mål
        </h2>
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>Effektivisera test- och QA-arbete</li>
          <li>Minska repetitiva manuella uppgifter</li>
          <li>Stödja riskbaserad och datadriven testning</li>
          <li>Visa praktisk användning av AI inom testning</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-blue-800 mb-2">
          Om tekniken
        </h2>
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>Frontend byggd med React och Tailwind CSS</li>
          <li>Backend med Node.js och Express</li>
          <li>AI-baserad textanalys för krav, tester och buggrapporter</li>
          <li>REST-API för kommunikation mellan frontend och backend</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-blue-800 mb-1">
          Om utvecklaren
        </h2>
        <p className="text-slate-700 text-sm">
          Projektet är utvecklat som en del av LIA-perioden av
          <strong> [Wasim El-jomaa]</strong> i samarbete med
          <strong> [Noor Engineering AB / 559036-2686]</strong>.
        </p>
      </section>

      <div className="pt-2">
        <Link
          to="/testcases"
          className="inline-flex items-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition"
        >
          Gå till Testfall
        </Link>
      </div>
    </div>
  );
}
