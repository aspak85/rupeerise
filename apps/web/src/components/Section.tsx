import { ReactNode } from "react";

export default function Section({ id, title, subtitle, children }: { id?: string; title?: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section id={id} className="px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        {title && (
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-2 text-zinc-300">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
