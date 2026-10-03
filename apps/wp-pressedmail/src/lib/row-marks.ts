/**
 * Layout of the small status marks that sit in a message row. The glyphs are
 * 16px, so the row never grows for them, and an invisible `after:` box gives
 * each one a pointer target.
 *
 * Two marks beside each other must not share pointer area. The phone row once
 * gave both a 12px halo at a 6px gap, so the right half of the left mark
 * opened the right mark's report, and the halo reached back over the end of the
 * subject and opened a report instead of the message. A halo may only take
 * what the gap beside it leaves over, so these are written as numbers a test
 * can add up.
 */

/** Desktop and dense lists: 24 by 32 around a 16px glyph. */
export const MARK_HIT_AREA =
  "relative after:absolute after:-inset-x-1 after:-inset-y-2 after:content-['']";

/** Phone rows: a thumb gets 28 by 28. */
export const MARK_HIT_AREA_TOUCH =
  "relative after:absolute after:-inset-1.5 after:content-['']";

/**
 * The phone row's pair. 14px between the glyphs, and each halo reaches 6px
 * toward its neighbour, so the two boxes stop 2px short of touching. The
 * outer halos reach 6px as well, which is the row's own gap to the subject
 * text, so the pair never takes a tap that belongs to the message.
 *
 * `ml-auto` pins the pair to the right end of the subject line. Without it the
 * marks followed the subject, a tag or a paperclip, so their x position moved
 * from row to row (the fish at 507px on one row and 700px on the next) and they
 * never formed a column to scan.
 *
 * A bag with no fish beside it keeps the fish's place. Both marks flag
 * exceptions only, so a newsletter row draws a bag and no fish, and `ml-auto`
 * alone put that bag where the fish sits on a row that has both: 30px apart
 * (the glyph and the gap) between rows, so the bag had no column of its own.
 * The bag says it leads the pair with `data-mark-slot="leading"`, and a leader
 * that is also the last child has no fish after it, so only then does it take
 * the fish's 16px and the 14px gap as a margin. The rule names the slot and not
 * the bag, so it says nothing about a Pro surface in the Free stylesheet. The
 * desktop rail does the same with a slot that holds its width.
 */
export const MARK_PAIR_TOUCH =
  "ml-auto flex shrink-0 items-center gap-3.5 empty:hidden [&>[data-mark-slot=leading]:last-child]:me-7.5";
