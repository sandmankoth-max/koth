import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, P, Bullets } from "@/components/koth/legal-doc";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — KOTH" },
      { name: "description", content: "The terms that govern your use of KOTH, including eligibility, content, safety, and prizes." },
    ],
  }),
  component: () => (
    <article className="mt-4 space-y-5 pb-10">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
      </header>
      <P>
        By creating an account, accessing, or using KOTH, you acknowledge that you have read and agree to
        these Terms of Service, the Privacy Policy, and the Official Challenge Rules.
      </P>

      <LegalSection title="1. Eligibility">
        <P>You must be at least 13 years old to create an account or use KOTH.</P>
        <P>
          If you are between 13 and 17 years old, you represent that you have permission from a parent or
          legal guardian to use KOTH, submit videos, participate in challenges, and receive any prize for
          which you may be eligible.
        </P>
        <P>
          KOTH may request reasonable information to verify a user's age, identity, eligibility, or parental
          permission before awarding a prize or continuing to provide access to the service.
        </P>
      </LegalSection>

      <LegalSection title="2. Accounts">
        <P>
          You are responsible for providing accurate account information and maintaining the confidentiality
          of your login credentials.
        </P>
        <P>
          You may not create an account using false information, impersonate another person, share an account,
          or create multiple accounts to gain an unfair advantage.
        </P>
        <P>
          You are responsible for activity occurring through your account. Notify KOTH promptly if you believe
          your account has been accessed without permission.
        </P>
      </LegalSection>

      <LegalSection title="3. Your Content">
        <P>
          You retain ownership of videos, profile photos, comments, and other content you submit to KOTH.
        </P>
        <P>
          You represent that you own your submitted content or have all rights, permissions, and consents
          necessary to submit and display it through KOTH. You may not submit content that infringes another
          person's copyright, trademark, privacy, publicity, or other rights.
        </P>
        <P>
          You should not record or submit a video containing another identifiable person unless you have that
          person's permission. If the person is a minor, you must have permission from the minor's parent or
          legal guardian.
        </P>
        <P>
          By submitting content, you grant KOTH a worldwide, non-exclusive, royalty-free license to host,
          store, reproduce, process, transcode, technically format, display, distribute, and make your content
          available within KOTH for the purposes of operating, moderating, promoting, and improving the
          service and administering competitions.
        </P>
        <P>
          This license continues for as long as reasonably necessary to operate KOTH, maintain backups,
          document competition results, resolve disputes, enforce agreements, or comply with applicable law.
        </P>
      </LegalSection>

      <LegalSection title="4. Recording and Submission Integrity">
        <P>
          Challenge submissions must be captured live using the in-app camera unless the applicable challenge
          expressly states otherwise.
        </P>
        <P>
          Pre-recorded, edited, artificially generated, digitally manipulated, misleading, staged, or
          otherwise fraudulent challenge submissions are prohibited.
        </P>
        <P>
          KOTH may remove, reject, adjust, investigate, or disqualify any submission that appears inaccurate,
          manipulated, unsafe, unverifiable, misleading, or inconsistent with the applicable challenge
          requirements.
        </P>
      </LegalSection>

      <LegalSection title="5. User Conduct">
        <P>You agree not to:</P>
        <Bullets
          items={[
            "Cheat, manipulate results, misreport a value, or interfere with competition integrity.",
            "Use multiple accounts, bots, scripts, automated systems, exploits, or unauthorized software to gain an advantage.",
            "Impersonate, threaten, harass, bully, abuse, stalk, or defraud another person.",
            "Submit unlawful, hateful, sexually explicit, excessively violent, threatening, defamatory, or otherwise harmful content.",
            "Submit content depicting illegal conduct, weapons, controlled substances, or activity that creates an unreasonable risk of injury.",
            "Attempt to access another user's account or interfere with KOTH's systems, security, or operation.",
            "Collect, publish, or misuse another user's personal information.",
            "Use KOTH for unauthorized commercial activity, gambling, wagering, or any unlawful purpose.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Physical Safety">
        <P>
          Some KOTH challenges involve exercise, balance, endurance, coordination, athletic activity, or other
          physical activity.
        </P>
        <P>
          Participation is voluntary. You are responsible for evaluating your health, physical ability,
          surroundings, equipment, supervision, weather, surface conditions, and other relevant circumstances
          before attempting a challenge.
        </P>
        <P>
          Do not attempt a challenge if you are injured, impaired, medically restricted, unfamiliar with the
          activity, unable to perform it safely, or located in an unsafe environment.
        </P>
        <P>
          Never attempt a challenge while driving, near traffic, near an unprotected height, in or near
          dangerous water, around unsafe equipment, or in any location where participation could endanger you
          or another person.
        </P>
        <P>
          Stop immediately if you experience pain, dizziness, shortness of breath, weakness, loss of balance,
          or any other warning sign.
        </P>
        <P>
          Nothing in KOTH constitutes medical, health, fitness, athletic, or professional advice. Consult a
          qualified medical professional when appropriate.
        </P>
      </LegalSection>

      <LegalSection title="7. Assumption of Risk">
        <P>
          Physical activities can involve inherent and unforeseen risks, including falls, collisions, strains,
          fractures, illness, property damage, serious injury, disability, or death.
        </P>
        <P>
          To the fullest extent permitted by law, you voluntarily assume the risks arising from your decision
          to attempt or participate in any challenge.
        </P>
        <P>
          A parent or legal guardian who permits a minor to use KOTH acknowledges the risks associated with
          the minor's participation and is responsible for deciding whether supervision or other precautions
          are appropriate.
        </P>
      </LegalSection>

      <LegalSection title="8. Challenges and Prizes">
        <P>
          Participation in KOTH challenges is also governed by the Official Challenge Rules, which are
          incorporated into these Terms.
        </P>
        <P>
          KOTH challenges offering prizes are intended to be skill-based competitions. No purchase or payment
          is required to enter or win.
        </P>
        <P>
          KOTH may verify submissions, correct reported values, resolve ties, determine eligibility,
          disqualify participants, withhold or revoke prizes, and modify, suspend, or cancel challenges as
          provided in the Official Challenge Rules.
        </P>
      </LegalSection>

      <LegalSection title="9. Moderation and Enforcement">
        <P>
          KOTH may review, restrict, remove, preserve, or disclose content when reasonably necessary to
          operate the service, enforce these Terms, protect users, investigate misconduct, comply with law, or
          respond to a valid legal request.
        </P>
        <P>
          KOTH may warn, restrict, suspend, or permanently terminate an account that violates these Terms, the
          Official Challenge Rules, community standards, applicable law, or the integrity or safety of the
          service.
        </P>
        <P>
          KOTH is not required to monitor every submission, post, comment, or interaction and cannot guarantee
          that all inappropriate content will be identified or removed immediately.
        </P>
      </LegalSection>

      <LegalSection title="10. Reports and Complaints">
        <P>
          Users may report inappropriate content, suspected cheating, safety concerns, intellectual-property
          violations, or other misconduct by contacting support@playkoth.app.
        </P>
        <P>
          Reports should contain enough information for KOTH to identify and evaluate the reported material or
          conduct.
        </P>
      </LegalSection>

      <LegalSection title="11. Intellectual Property">
        <P>
          KOTH's software, design, features, graphics, logos, branding, text, and other service materials,
          excluding user content, are owned by or licensed to KOTH and are protected by applicable
          intellectual-property laws.
        </P>
        <P>
          You may not copy, reverse engineer, modify, distribute, sell, sublicense, or create derivative works
          from KOTH except as expressly permitted by applicable law.
        </P>
      </LegalSection>

      <LegalSection title="12. Third-Party Services">
        <P>
          KOTH may depend on third-party hosting, storage, authentication, analytics, notification,
          communication, payment, or infrastructure providers.
        </P>
        <P>
          Your use of certain third-party services may also be governed by those providers' separate terms and
          privacy policies.
        </P>
      </LegalSection>

      <LegalSection title="13. Availability and Changes to the Service">
        <P>KOTH may add, remove, suspend, modify, or discontinue features at any time.</P>
        <P>
          Access may occasionally be interrupted because of maintenance, technical failures, security
          concerns, legal requirements, or events outside KOTH's reasonable control.
        </P>
        <P>
          KOTH does not guarantee that the app, any challenge, or any particular feature will always be
          available, uninterrupted, secure, or error-free.
        </P>
      </LegalSection>

      <LegalSection title="14. Disclaimer of Warranties">
        <P>
          TO THE FULLEST EXTENT PERMITTED BY LAW, KOTH IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS
          WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY.
        </P>
        <P>
          KOTH does not guarantee the accuracy of user submissions, leaderboard information, comments,
          reported values, availability, or competition outcomes.
        </P>
      </LegalSection>

      <LegalSection title="15. Limitation of Liability">
        <P>
          TO THE FULLEST EXTENT PERMITTED BY LAW, KOTH AND ITS OWNERS, OPERATORS, ADMINISTRATORS, CONTRACTORS,
          SERVICE PROVIDERS, AND AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST DATA, OR LOSS OF GOODWILL,
          ARISING FROM OR RELATED TO KOTH.
        </P>
        <P>
          To the fullest extent permitted by law, KOTH is not responsible for injury, illness, death, property
          damage, loss, or other harm resulting from a user's decision to attempt a challenge, disregard
          safety instructions, misuse the service, or rely on content submitted by another user.
        </P>
        <P>Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited.</P>
      </LegalSection>

      <LegalSection title="16. Indemnification">
        <P>
          To the fullest extent permitted by law, you agree to defend, indemnify, and hold harmless KOTH and
          its owners, operators, administrators, contractors, service providers, and affiliates from claims,
          liabilities, damages, losses, and reasonable costs arising from your content, your conduct, your
          misuse of the service, your violation of these Terms, or your violation of another person's rights.
        </P>
      </LegalSection>

      <LegalSection title="17. Governing Law and Disputes">
        <P>
          These Terms are governed by the laws of the State of California, without regard to conflict-of-law
          principles.
        </P>
        <P>
          Any dispute arising from or relating to KOTH or these Terms will be subject to the jurisdiction of
          the state and federal courts located in California, unless applicable law requires otherwise.
        </P>
        <P>
          Before filing a formal legal claim, you agree to contact KOTH at support@playkoth.app and make a
          good-faith effort to resolve the dispute informally.
        </P>
      </LegalSection>

      <LegalSection title="18. Changes to These Terms">
        <P>
          KOTH may update these Terms from time to time. When material changes are made, KOTH may provide
          notice through the app, the website, email, or another reasonable method.
        </P>
        <P>
          The updated Terms will state a revised last updated date. Continued use of KOTH after revised Terms
          become effective constitutes acceptance of the revised Terms, to the extent permitted by law.
        </P>
      </LegalSection>

      <LegalSection title="19. Severability and No Waiver">
        <P>
          If any provision of these Terms is found unenforceable, the remaining provisions will remain in
          effect to the fullest extent permitted by law.
        </P>
        <P>
          KOTH's failure to enforce a provision does not waive its right to enforce that provision later.
        </P>
      </LegalSection>

      <LegalSection title="20. Entire Agreement">
        <P>
          These Terms, the Privacy Policy, the Official Challenge Rules, and any challenge-specific
          instructions presented in KOTH form the agreement governing your use of KOTH.
        </P>
      </LegalSection>

      <LegalSection title="21. Contact">
        <P>Questions about these Terms may be sent to: support@playkoth.app</P>
      </LegalSection>
    </article>
  ),
});
