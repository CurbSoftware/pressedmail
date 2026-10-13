# Pure mail questions

These versioned question packs contain wording, type definitions and raw answer
mapping only. They do not read environment variables, credentials, databases,
licences, ledgers or provider transports. PressedMail's existing worker and the
dedicated Curb.Email code share the questions, with separate authority and costs.

Set 2 and set 3 retain their original wording and output contracts. A wording
change needs a new version and fresh calibration; typed probabilities do not
prove a message is safe or authorize an automatic action. Set 1 remains frozen
in the PressedMail worker for installed clients.

Question IDs are keys for code, rather than model instructions. Noul values are
the probability of yes; a value near 0.5 is uncertainty. Choice distributions
must contain every defined option and sum to one. Consumers validate all
requested answers before calling the raw mapping helpers. A missing result
fails its task instead of becoming a zero or a clean verdict.
