/**
 * The one grid every composer metadata row uses: label | field | actions.
 *
 * From, To, Cc, Bcc and Subject all render this. The label column takes only
 * its own width, the field column absorbs the rest and can shrink to nothing,
 * and the action cluster keeps its intrinsic width. No flex-wrap, no fixed
 * field widths: a narrow pane squeezes the field, never drops the buttons to a
 * second line. src/test/composer-row-contract.test.ts pins every row to it.
 */
export const COMPOSER_ROW_CLASS =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2";
