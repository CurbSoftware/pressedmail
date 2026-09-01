/**
 * Free-edition AI plugin kit: empty.
 *
 * The composer is shared, so `plate-composer.tsx` always references an AI kit
 * and decides at runtime whether to activate it. A static import of the real
 * kit therefore pulled the whole AI stack, chat transport, menu, nodes,
 * suggestion plugin, `lib/ai-rest`, into the Free bundle, where AI is not a
 * feature at all. Rollup cannot drop it, because a runtime flag is not a
 * build-time constant.
 *
 * Returning an empty plugin list keeps the composer's shape identical while the
 * implementation stays out of the Free build entirely.
 */
export const ComposerAIKit = [];
