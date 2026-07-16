import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — KOTH" }] }),
  component: () => (
    <article className="mt-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
      </header>
      <Section title="Your content">
        You confirm that you own all content you submit, including video recordings, and that no third party
        owns rights that prevent you from sharing it on KOTH. You grant KOTH a license to host, transcode, and
        display your content within the app for the purpose of running the competition.
      </Section>
      <Section title="No pre-recorded or manipulated video">
        Submissions must be captured live using the in-app camera. Pre-recorded, edited, or otherwise
        manipulated video is not allowed and may be removed or disqualified.
      </Section>
      <Section title="Account and conduct">
        Do not impersonate others, abuse other users, or attempt to game the leaderboard. KOTH may suspend or
        remove accounts that violate these terms.
      </Section>
      <Section title="Physical safety and liability">
        Many challenges involve physical activity. You assume all risk of personal injury arising from any
        challenge attempt. KOTH is not liable for any injury, loss, or damage that results from your
        participation. Do not attempt anything that exceeds your physical ability or your environment.
      </Section>
      <Section title="Changes">
        We may update these terms; continued use after changes constitutes acceptance.
      </Section>
    </article>
  ),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="label-broadcast text-koth-red">{title}</h2>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </section>
  );
}
