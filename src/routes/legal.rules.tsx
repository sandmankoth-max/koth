import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, P, Bullets } from "@/components/koth/legal-doc";

export const Route = createFileRoute("/legal/rules")({
  head: () => ({
    meta: [
      { title: "Official Rules — KOTH" },
      { name: "description", content: "Official Challenge Rules for KOTH: eligibility, entry, judging, ties, prizes, and disqualification." },
    ],
  }),
  component: () => (
    <article className="mt-4 space-y-5 pb-10">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Official Challenge Rules</h1>
      </header>
      <P>
        No purchase or payment is necessary to enter or win. KOTH challenges are skill-based competitions. A
        purchase will not improve a participant's chance of winning.
      </P>

      <LegalSection title="1. Sponsor and Administrator">
        <P>
          KOTH challenges are sponsored and administered by the developer and operator of KOTH, referred to in
          these rules as "KOTH."
        </P>
        <P>
          Apple Inc. is not a sponsor of, responsible for, or involved in KOTH challenges, competitions,
          prizes, judging, administration, or winner selection in any manner.
        </P>
      </LegalSection>

      <LegalSection title="2. Agreement to the Rules">
        <P>
          By entering a KOTH challenge, you agree to these Official Challenge Rules, the Terms of Service, the
          Privacy Policy, and any instructions or criteria displayed for that particular challenge.
        </P>
        <P>
          If challenge-specific instructions conflict with these general rules, the challenge-specific
          instructions will control for that challenge, except where prohibited by law.
        </P>
      </LegalSection>

      <LegalSection title="3. Eligibility">
        <P>You must be at least 13 years old and have a valid KOTH account to participate.</P>
        <P>
          If you are between 13 and 17 years old, you represent that you have permission from a parent or
          legal guardian to use KOTH, submit videos, participate in challenges, and receive a cash,
          gift-card, or other prize.
        </P>
        <P>
          A winner may be required to provide reasonable proof of identity, age, eligibility, parental
          permission, or compliance with these rules before receiving a prize.
        </P>
        <P>
          Challenges are void where prohibited or restricted by law. KOTH may exclude a participant or
          location when reasonably necessary to comply with applicable law.
        </P>
      </LegalSection>

      <LegalSection title="4. Challenge Period">
        <P>
          Challenges generally begin Monday at 10:00 a.m. local time and close the following Sunday at 5:00
          p.m. local time.
        </P>
        <P>
          Exact start times, deadlines, prize information, judging criteria, and challenge requirements may
          vary. The in-app countdown and challenge page control for the active challenge.
        </P>
        <P>
          KOTH's systems and records are the official timekeeping method for determining whether an entry was
          timely received.
        </P>
      </LegalSection>

      <LegalSection title="5. How to Enter">
        <P>
          To enter, an eligible user must complete the applicable challenge, record the attempt through the
          in-app camera, provide any requested measurement or information, and submit the entry before the
          deadline.
        </P>
        <P>No purchase, payment, subscription, or entry fee is required.</P>
      </LegalSection>

      <LegalSection title="6. Number of Attempts">
        <P>
          Unless the challenge states otherwise, users may record and submit multiple attempts before the
          deadline.
        </P>
        <P>
          Only the user's most recent eligible submission will count toward the final leaderboard position,
          even if an earlier submission had a better reported result.
        </P>
      </LegalSection>

      <LegalSection title="7. Recording Requirements">
        <P>
          Every challenge submission must be recorded live through the in-app camera unless the challenge
          expressly permits another method.
        </P>
        <P>
          Camera-roll uploads, pre-recorded videos, spliced footage, altered playback speed, hidden cuts,
          misleading camera angles, artificial intelligence-generated content, and other manipulated
          submissions are prohibited.
        </P>
        <P>
          Videos must clearly show enough of the attempt for KOTH to assess compliance, safety, timing, form,
          repetitions, distance, or other applicable criteria.
        </P>
      </LegalSection>

      <LegalSection title="8. Submission Requirements">
        <P>Entries must:</P>
        <Bullets
          items={[
            "Accurately depict the participant's attempt.",
            "Comply with the challenge instructions.",
            "Contain an accurate self-reported value.",
            "Be submitted through the participant's own account.",
            "Be captured before the challenge deadline.",
            "Comply with applicable law and these rules.",
            "Avoid infringing another person's intellectual property, privacy, or publicity rights.",
            "Avoid exposing private information or depicting another person without appropriate permission.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Skill-Based Winner Determination">
        <P>
          Winners are determined based on skill and the criteria described for the applicable challenge, such
          as verified time, repetitions, distance, accuracy, form, performance, or another objective or stated
          skill measure.
        </P>
        <P>Winners are not determined by random selection, chance, wagering, or payment.</P>
        <P>
          Community activity, comments, likes, or voting will not determine a winner unless a challenge
          specifically states that community evaluation is an announced judging criterion.
        </P>
      </LegalSection>

      <LegalSection title="10. Verification and Administration">
        <P>
          Leaderboard positions may initially reflect values reported by users and remain provisional until
          verification is complete.
        </P>
        <P>
          KOTH administrators may review videos, compare reported values with recorded performance, correct
          measurements, request additional information, flag entries for follow-up, and disqualify entries.
        </P>
        <P>
          KOTH may delay final results while investigating suspected cheating, technical errors, duplicate
          accounts, safety issues, eligibility questions, or other concerns affecting competition integrity.
        </P>
      </LegalSection>

      <LegalSection title="11. Ties">
        <P>If two or more eligible submissions have the same verified result, KOTH may resolve the tie by:</P>
        <Bullets
          items={[
            "Conducting a closer review of the videos.",
            "Applying an announced secondary skill-based criterion.",
            "Considering greater precision in the verified measurement, where available.",
            "Declaring a shared position.",
            "Dividing the applicable prize evenly.",
          ]}
        />
        <P>KOTH will not use a random drawing to resolve a tie in a skill-based challenge.</P>
      </LegalSection>

      <LegalSection title="12. Prizes">
        <P>
          The prize amount or description for a challenge will be displayed in the app before that challenge
          closes.
        </P>
        <P>
          Prizes may differ between challenges. A prize has no cash equivalent unless KOTH expressly states
          otherwise.
        </P>
        <P>
          Prizes are not transferable except at KOTH's discretion and may not be substituted by a winner. KOTH
          may substitute a prize of equal or greater value when the advertised prize becomes unavailable for
          reasons outside KOTH's reasonable control.
        </P>
      </LegalSection>

      <LegalSection title="13. Winner Notification and Prize Claims">
        <P>
          Potential winners may be contacted through the app, activity feed, push notification, email, or
          other contact information associated with their account.
        </P>
        <P>
          A potential winner may be required to respond, confirm payment details, verify eligibility, obtain
          parental permission, or complete other reasonable verification steps within the period specified by
          KOTH.
        </P>
        <P>
          Unless KOTH provides a different deadline, a winner must respond to a prize notification within 14
          calendar days.
        </P>
        <P>
          If a potential winner does not respond, cannot be contacted, provides inaccurate information, fails
          verification, declines the prize, or violates these rules, KOTH may revoke the prize and award it to
          the next eligible participant.
        </P>
      </LegalSection>

      <LegalSection title="14. Prize Delivery">
        <P>
          Prizes are paid or delivered manually outside the app within a reasonable period after results are
          finalized and the winner completes any required verification.
        </P>
        <P>
          Delivery time may depend on the winner's response, payment method, identity verification, fraud
          review, parental permission, service-provider availability, and other reasonable administrative
          requirements.
        </P>
        <P>KOTH will maintain reasonable records of finalized rankings and prize delivery.</P>
      </LegalSection>

      <LegalSection title="15. Taxes and Expenses">
        <P>
          Winners are responsible for taxes, fees, and expenses associated with accepting or using a prize,
          except where applicable law requires otherwise.
        </P>
        <P>
          KOTH may request tax or identification information and may issue tax documentation when required by
          law.
        </P>
      </LegalSection>

      <LegalSection title="16. Disqualification">
        <P>
          KOTH may remove an entry, suspend an account, revoke a ranking, or withhold or recover a prize if
          KOTH reasonably determines that a participant:
        </P>
        <Bullets
          items={[
            "Submitted false or misleading information.",
            "Manipulated or edited a submission.",
            "Used a pre-recorded video.",
            "Misreported a performance value.",
            "Used multiple accounts or another person's account.",
            "Interfered with another participant.",
            "Used bots, exploits, or unauthorized software.",
            "Attempted to influence an administrator improperly.",
            "Engaged in dangerous or unlawful conduct.",
            "Violated these rules or the Terms of Service.",
            "Compromised or attempted to compromise the fairness, integrity, security, or operation of a challenge.",
          ]}
        />
      </LegalSection>

      <LegalSection title="17. Safety">
        <P>
          Participants must use reasonable judgment and attempt challenges only under conditions that are
          appropriate for their health, experience, surroundings, and abilities.
        </P>
        <P>
          Participants must not trespass, violate laws, interfere with traffic, use unsafe equipment, endanger
          bystanders, or perform a challenge in a location that creates an unreasonable risk of harm.
        </P>
        <P>
          KOTH may reject or remove any entry that depicts or encourages unsafe conduct, regardless of the
          participant's result.
        </P>
      </LegalSection>

      <LegalSection title="18. Technical Problems">
        <P>
          KOTH is not responsible for entries that are late, incomplete, corrupted, interrupted, misdirected,
          inaccessible, or not received because of internet failure, device failure, storage limitations,
          platform outages, software errors, or other technical problems.
        </P>
        <P>
          Participants are responsible for allowing enough time to record, upload, and submit an entry before
          the deadline.
        </P>
      </LegalSection>

      <LegalSection title="19. Modification, Suspension, or Cancellation">
        <P>
          KOTH may modify, extend, postpone, suspend, or cancel a challenge when reasonably necessary because
          of fraud, cheating, technical failures, insufficient eligible entries, safety concerns, legal
          requirements, service outages, events beyond KOTH's reasonable control, or circumstances that
          prevent fair administration.
        </P>
        <P>
          If a challenge is modified or canceled, KOTH may determine an appropriate outcome based on eligible
          entries received before the disruption or may decline to award a prize where permitted by law.
        </P>
      </LegalSection>

      <LegalSection title="20. Administrative Decisions">
        <P>
          KOTH's decisions concerning eligibility, verification, compliance, rankings, ties, disqualification,
          and prize administration are final to the fullest extent permitted by law.
        </P>
        <P>
          A participant who believes an administrative error occurred may contact support@playkoth.app with
          supporting information.
        </P>
      </LegalSection>

      <LegalSection title="21. Release and Limitation of Liability">
        <P>
          To the fullest extent permitted by law, participants release KOTH and its owners, operators,
          administrators, contractors, service providers, and affiliates from claims arising from
          participation in a challenge or acceptance or use of a prize, except for liability that cannot
          legally be waived.
        </P>
        <P>
          Participation in physical activity is voluntary, and participants assume the risks associated with
          their own challenge attempts as described in the Terms of Service.
        </P>
      </LegalSection>

      <LegalSection title="22. Privacy">
        <P>
          Information collected in connection with a challenge will be handled according to the KOTH Privacy
          Policy and may be used to verify entries, determine rankings, contact winners, deliver prizes,
          prevent fraud, and document competition results.
        </P>
      </LegalSection>

      <LegalSection title="23. Changes to These Rules">
        <P>KOTH may revise these Official Challenge Rules.</P>
        <P>
          Material changes will not be applied retroactively in a manner that unfairly changes the announced
          winner-selection criteria for a challenge that has already closed, except when necessary to comply
          with law or address fraud or a material administrative error.
        </P>
      </LegalSection>

      <LegalSection title="24. Contact">
        <P>Questions concerning a challenge or prize may be sent to: support@playkoth.app</P>
      </LegalSection>
    </article>
  ),
});
