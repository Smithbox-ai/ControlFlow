# Review Checklist

Review in this order:

1. Does the change violate the intended behavior or the user's request?
2. Could it corrupt data, skip validation, leak access, or break authorization?
3. Could it introduce race conditions, ordering bugs, or state divergence?
4. Does it create performance or scale regressions on likely hot paths?
5. Did the implementation drift away from the plan, contract, or schema?
6. Are tests missing for the riskiest behavior?
7. Are docs, migration notes, or operational steps missing where they should have changed?
