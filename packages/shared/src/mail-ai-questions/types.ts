export type TagInput = { id: string; name: string; description: string };
export type NoulAnswer = { noul: number };
export type ChoiceAnswer = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type Answers = Record<
  string,
  Partial<NoulAnswer & ChoiceAnswer> | undefined
>;
