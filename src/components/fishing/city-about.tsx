import ReactMarkdown from "react-markdown";

export default function CityAbout({
  md,
  cityName,
}: {
  md: string | null;
  cityName: string;
}) {
  if (!md) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
        About Fishing {cityName}
      </h2>
      <div className="max-w-3xl">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="text-base leading-relaxed text-slate-700 mb-4">
                {children}
              </p>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-bold text-slate-900 mt-6 mb-2">
                {children}
              </h3>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 text-slate-700 mb-4">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1 text-slate-700 mb-4">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-base leading-relaxed">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900">{children}</strong>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-blue-700 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {md}
        </ReactMarkdown>
      </div>
    </section>
  );
}
