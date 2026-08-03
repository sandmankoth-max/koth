import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, P, Bullets } from "@/components/koth/legal-doc";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — KOTH" },
      { name: "description", content: "What information KOTH collects, how it is used and shared, and the choices available to users." },
    ],
  }),
  component: () => (
    <article className="mt-4 space-y-5 pb-10">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
      </header>
      <P>
        This Privacy Policy explains what information KOTH collects, how that information is used and shared,
        and the choices available to users.
      </P>

      <LegalSection title="1. Information We Collect">
        <P>Depending on how you use KOTH, we may collect the following categories of information:</P>
        <Bullets
          items={[
            "Account information, such as your username, display name, email address, date of birth, and age or parental-permission acknowledgment.",
            "Authentication information. Passwords are processed using secure authentication methods and are not intended to be stored in readable plaintext.",
            "Optional profile information, including a profile photograph.",
            "Videos, comments, likes, challenge entries, reported measurements, rankings, and other content you submit.",
            "Social information, such as friend requests, friendships, followers, or interactions with other users.",
            "Notification information, such as challenge announcements, deadline reminders, likes, comments, friend requests, verification results, and ranking changes.",
            "Support communications and other information you voluntarily provide when contacting KOTH.",
            "Technical and usage information that may be automatically generated when you use the app, such as device type, operating-system version, IP address, app activity, crash information, diagnostic information, and approximate access times.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. How We Use Information">
        <P>KOTH may use information to:</P>
        <Bullets
          items={[
            "Create, authenticate, and maintain accounts.",
            "Operate weekly challenges and leaderboards.",
            "Review and verify challenge submissions.",
            "Correct or confirm reported measurements.",
            "Determine rankings and prize eligibility.",
            "Deliver prizes and contact winners.",
            "Provide social features and activity feeds.",
            "Send service and competition notifications.",
            "Moderate content and enforce app rules.",
            "Detect fraud, cheating, abuse, and security threats.",
            "Respond to support requests and disputes.",
            "Maintain, analyze, secure, and improve KOTH.",
            "Comply with legal obligations and valid requests.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Videos and User Content">
        <P>
          Challenge videos and social posts are stored using KOTH's service providers and may be reviewed by
          authorized administrators.
        </P>
        <P>
          Signed-in users may be able to view leaderboard videos, profile information, reported values,
          comments, likes, and rankings.
        </P>
        <P>Friends may be able to view videos and other activity shared through the friends feed.</P>
        <P>
          Although storage systems may restrict direct public access, content displayed within the app should
          not be considered private if other users are permitted to view it.
        </P>
      </LegalSection>

      <LegalSection title="4. Information Visible to Other Users">
        <P>
          Depending on your activity and app settings, the following information may be visible to other
          signed-in users:
        </P>
        <Bullets
          items={[
            "Username and display name.",
            "Profile photograph.",
            "Challenge submissions and videos.",
            "Reported or verified performance values.",
            "Leaderboard position and challenge history.",
            "Comments, likes, friendships, and social activity.",
          ]}
        />
        <P>
          Your date of birth, password, and private authentication information are not displayed on public
          leaderboards.
        </P>
      </LegalSection>

      <LegalSection title="5. How Information May Be Shared">
        <P>KOTH may share information:</P>
        <Bullets
          items={[
            "With other users as necessary to provide profiles, leaderboards, videos, comments, social feeds, and other app features.",
            "With service providers that assist with cloud hosting, data storage, authentication, notifications, analytics, security, support, communications, or prize administration.",
            "When reasonably necessary to investigate fraud, cheating, abuse, safety threats, or violations of these policies.",
            "When required by law, legal process, court order, or a valid government request.",
            "To protect the rights, safety, property, or security of KOTH, its users, or others.",
            "In connection with a merger, financing, acquisition, sale, restructuring, or transfer of all or part of the KOTH business or assets, subject to applicable law.",
          ]}
        />
        <P>KOTH does not sell personal information in exchange for money.</P>
      </LegalSection>

      <LegalSection title="6. Prizes and Winner Verification">
        <P>
          KOTH may request information reasonably necessary to confirm a winner's identity, age, eligibility,
          parental permission, contact information, or payment information.
        </P>
        <P>
          Prize information may be shared with payment providers or other service providers as necessary to
          deliver a prize, document payment, prevent fraud, or comply with legal and tax obligations.
        </P>
      </LegalSection>

      <LegalSection title="7. Data Retention">
        <P>
          KOTH retains information for as long as reasonably necessary to provide the service, administer
          competitions, maintain security, prevent fraud, resolve disputes, comply with legal obligations, and
          enforce its agreements.
        </P>
        <P>
          Some information may remain temporarily in backups or may be retained when necessary to document
          prize payments, competition results, moderation actions, fraud investigations, legal compliance, or
          disputes.
        </P>
      </LegalSection>

      <LegalSection title="8. Account and Data Deletion">
        <P>
          Users may request deletion through any available in-app account-deletion feature or by contacting:
          support@playkoth.app
        </P>
        <P>
          Deleting an account generally removes or deidentifies the user's profile, submissions, friendships,
          notifications, and related account information, subject to reasonable processing time and legal or
          operational retention requirements.
        </P>
        <P>
          Content already shared with or copied by other users may not be fully retrievable or removable from
          those users' possession.
        </P>
      </LegalSection>

      <LegalSection title="9. Children's Privacy">
        <P>
          KOTH is not intended for children under 13, and users under 13 are not permitted to create an
          account.
        </P>
        <P>
          If KOTH learns that it collected personal information from a child under 13 without legally
          sufficient authorization, it may suspend the account and delete the information as required by
          applicable law.
        </P>
        <P>
          A parent or guardian who believes a child under 13 has provided personal information may contact:
          support@playkoth.app
        </P>
      </LegalSection>

      <LegalSection title="10. Data Security">
        <P>
          KOTH uses reasonable administrative, technical, and organizational measures intended to protect user
          information.
        </P>
        <P>
          However, no storage system, network, transmission, or online service can guarantee absolute
          security. Users should maintain secure passwords and protect access to their devices and accounts.
        </P>
      </LegalSection>

      <LegalSection title="11. Your Choices">
        <P>Depending on available app features, users may be able to:</P>
        <Bullets
          items={[
            "Update profile and account information.",
            "Choose whether to upload an optional profile photo.",
            "Manage certain notification settings.",
            "Delete content or request account deletion.",
            "Contact KOTH regarding privacy questions.",
          ]}
        />
      </LegalSection>

      <LegalSection title="12. State Privacy Rights">
        <P>
          Residents of certain states may have rights concerning access, correction, deletion, or disclosure
          of personal information, subject to applicable legal exceptions.
        </P>
        <P>
          Requests may be submitted to support@playkoth.app. KOTH may take reasonable steps to verify the
          requester's identity before completing a request.
        </P>
      </LegalSection>

      <LegalSection title="13. External Links and Services">
        <P>
          KOTH may contain links to external websites, payment services, or third-party services. Their
          privacy practices are governed by their own policies, not this Privacy Policy.
        </P>
      </LegalSection>

      <LegalSection title="14. Changes to This Privacy Policy">
        <P>
          KOTH may update this Privacy Policy as its practices, services, or legal obligations change.
        </P>
        <P>
          Material updates may be communicated through the app, website, email, or another reasonable method.
        </P>
      </LegalSection>

      <LegalSection title="15. Contact">
        <P>Questions or requests concerning this Privacy Policy may be sent to: support@playkoth.app</P>
      </LegalSection>
    </article>
  ),
});
