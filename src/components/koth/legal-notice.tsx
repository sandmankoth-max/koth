/**
 * Banner shown at the top of every legal page so users know the copy is
 * plain-language placeholder text and not a finalized legal document.
 */
export function LegalNotice() {
  return (
    <div className="mt-2 rounded-2xl bg-koth-pr-bg p-3 text-xs leading-snug text-koth-pr-text">
      <strong className="label-broadcast">Heads up:</strong> This is plain-language placeholder text. KOTH's
      legal documents must be reviewed by a qualified attorney before launch.
    </div>
  );
}
