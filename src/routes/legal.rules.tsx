import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/rules")({
  head: () => ({ meta: [{ title: "Official Rules — KOTH" }] }),
  component: () => (
    <article className="mt-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Official Rules</h1>
      </header>
      <Section title="Eligibility">
        You must be 13 or older to create an account on KOTH. If you are between 13 and 17, you confirm at
        signup that you have a parent or guardian's permission to use the app, submit videos, and be eligible
        for any cash or gift card prize.
      </Section>
      <Section title="How challenges work">
        Challenges usually start Monday at 10:00am local time and close the following Sunday at 5:00pm,
        though the exact schedule can change depending on the challenge — always check the in-app countdown
        for the active challenge. You may record and submit as many attempts as you want before the deadline.
        Only your most recent submission counts toward your leaderboard position.
      </Section>
      <Section title="Recording requirements">
        Every submission must be recorded live using the in-app camera. Uploads from your camera roll are not
        accepted. Submissions found to be pre-recorded, edited, or manipulated may be disqualified at KOTH's
        sole discretion.
      </Section>
      <Section title="Winners and verification">
        Final rankings are determined by the value you self-report, subject to admin review. KOTH may adjust a
        submission's verified value, flag it for follow-up, or disqualify it for any reason consistent with
        these rules.
      </Section>
      <Section title="Prizes">
        Prize amounts vary per challenge and will always be displayed in-app before the challenge closes.
        Prizes are paid manually outside the app within a reasonable time after results are finalized.
      </Section>
      <Section title="Ties">
        Ties are resolved by an admin based on closer review of the submissions. An admin may also choose to
        split a position, in which case both users receive the same rank and the prize is divided evenly.
      </Section>
      <Section title="Disqualification">
        KOTH may remove content, suspend an account, or disqualify a submission for fraud, safety violations,
        or violations of these rules.
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
