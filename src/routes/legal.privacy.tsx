import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — KOTH" }] }),
  component: () => (
    <article className="mt-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
      </header>
      <Section title="What we collect">
        Username, display name, password (hashed), date of birth, age-consent acknowledgment, optional
        profile photo, the videos you submit, and the numeric values you self-report.
      </Section>
      <Section title="How videos are stored and shared">
        Videos are stored in private storage. Other signed-in KOTH users can view leaderboard videos to verify
        rankings; your friends can view your videos in their friends feed. Admins can review any submission.
      </Section>
      <Section title="What's public on the leaderboard">
        Your username, display name, profile photo, and reported value are visible to all signed-in users on
        the leaderboard. Date of birth is never shown publicly.
      </Section>
      <Section title="Notifications">
        We log notifications (new challenges, deadline reminders, rank changes) tied to your account so they
        appear on your activity feed.
      </Section>
      <Section title="Data deletion">
        Deleting your account removes your profile, submissions, friendships, and notifications.
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
