import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-300/30 to-indigo-300/30 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-emerald-300/30 to-cyan-300/30 blur-2xl" />

          <div className="relative space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
                    🤖
                  </span>
                  <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                      AI-assistent för testning & kvalitetssäkring
                    </h1>
                    <p className="mt-2 max-w-3xl text-slate-600">
                      En intern och kundanpassad AI-assistent som stödjer testare och
                      testledare i arbetet med testning och kvalitetssäkring av mjukvara.
                      Fokus ligger på att effektivisera testprocesser, minska manuellt
                      arbete och höja kvaliteten med hjälp av AI.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    AI & NLP
                  </span>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                    QA / Testledning
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Datadrivet beslutsstöd
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <Link
                  to="/about"
                  className="rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm border border-slate-200 hover:bg-white"
                >
                  Om projektet
                </Link>
                <Link
                  to="/projects"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700"
                >
                  Öppna projekt →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* GRID SECTIONS */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Purpose */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-bold text-blue-900 mb-3">🎯 Syfte</h2>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Snabbare skapa relevanta testfall</li>
              <li>Identifiera risker tidigt i testfasen</li>
              <li>Säkerställa stabilitet vid kodändringar</li>
              <li>Förbättra överblick och beslutsfattande</li>
            </ul>
          </section>

          {/* Target group */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-bold text-blue-900 mb-3">🧠 Målgrupp</h2>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Testare</li>
              <li>Testledare</li>
              <li>QA-team</li>
              <li>Utvecklingsteam</li>
              <li>Organisationer som vill arbeta mer datadrivet med kvalitetssäkring</li>
            </ul>
          </section>

          {/* Technology */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-bold text-blue-900 mb-3">🛠️ Teknik</h2>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>AI / NLP för analys av krav, tester och buggrapporter</li>
              <li>Integration med test- och ärendehanteringsverktyg</li>
              <li>Anpassningsbar för interna och kundspecifika behov</li>
            </ul>
          </section>
        </div>

        {/* FEATURES */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              🚀 Funktioner
            </h2>
            <span className="text-sm text-slate-500">
              Exempel på stöd i test- och QA-flödet
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Generering av testfall från krav",
                desc: "Automatiskt omvandla kravspecifikationer till strukturerade testfall.",
                accent: "from-blue-500 to-indigo-500",
              },
              {
                title: "Identifiering av riskområden",
                desc: "Analys av krav, kodändringar och historiska buggar för att prioritera testning.",
                accent: "from-rose-500 to-pink-500",
              },
              {
                title: "Förslag på regressionstester",
                desc: "Rekommendationer på vilka tester som bör köras vid ändringar i koden.",
                accent: "from-amber-500 to-yellow-500",
              },
              {
                title: "Sammanfattning av testresultat",
                desc: "Tydliga och lättförståeliga sammanfattningar för testledning och team.",
                accent: "from-emerald-500 to-cyan-500",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]"
              >
                <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${f.accent}`} />
                <div className="pl-3">
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BENEFITS */}
        <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-7">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-blue-900 mb-1">
                📈 Förväntad nytta
              </h2>
              <p className="text-sm text-blue-900/70">
                Varför detta ger värde för team och projekt.
              </p>
            </div>

            <Link
              to="/about"
              className="inline-flex w-fit items-center justify-center rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-blue-900 shadow-sm border border-blue-200 hover:bg-white"
            >
              Läs mer →
            </Link>
          </div>

          <ul className="mt-5 grid gap-3 md:grid-cols-2 text-sm text-slate-700">
            <li className="rounded-xl bg-white/70 border border-blue-200/60 p-4">
              ✅ Minskad tid för manuellt testarbete
            </li>
            <li className="rounded-xl bg-white/70 border border-blue-200/60 p-4">
              ✅ Förbättrad testtäckning och kvalitet
            </li>
            <li className="rounded-xl bg-white/70 border border-blue-200/60 p-4">
              ✅ Bättre prioritering av testinsatser
            </li>
            <li className="rounded-xl bg-white/70 border border-blue-200/60 p-4">
              ✅ Tydligare kommunikation mellan team
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
