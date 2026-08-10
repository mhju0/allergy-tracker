# Food Allergy Tracking

The language for introducing foods one at a time, recording what was observed, and maintaining a trustworthy history for parents.

## Language

**Trial**:
A bounded period in which one food is introduced and watched without starting another food. It remains active until a safe, reacted, or cancelled outcome is persisted.
_Avoid_: Test

**Observation**:
Persisted evidence that a parent observed no reaction on one eligible day of a Trial. It may be recorded on that day or recalled later, contributes to coverage, and does not determine the Trial outcome by itself.
_Avoid_: Check-in, clear day

**Check-in**:
The interaction through which a parent records an Observation, whether live, by backfilling the ledger, or from a notification.
_Avoid_: Observation when naming the interaction

**Coverage**:
The number of eligible Trial calendar days that contain at least one Observation. Multiple Observation rows on the same day count once.
_Avoid_: Check-in count
