/* WB-V2-P2 kontrollpunkti PUHAS olek — ilma prisma/serveri sõltuvuseta.
   Eraldatud `checkpoint.js`-ist, et sama otsust saaks kasutada NII server
   (U1 taimer, adapter) KUI klient (badge, „kas pidas?") ilma prismat
   brauseri-bundle'isse tõmbamata. `checkpoint.js` re-ekspordib need, nii et
   serveripoole imporditee ei muutu.

   Kandev piir (ptk 3.4 p2, W-INV-4): vahelejätmine on VÕRDVÄÄRNE tulemus —
   ei loendurit, striiki ega „võlga". Badge tähendab „siin ootab sinu vastus",
   mitte „sa oled hiljaks jäänud". */
export const CHECKPOINT_FOLLOW_UP_STATES = Object.freeze(["kept", "not_kept", "unclear"]);

/* Üks otsustaja badge'ile ja U1 taimerile, muidu läheks teavitus ja kuva
   lahku. `dueOn` tagastatakse Date-ina; tarbija vormindab ise. */
export function describeWellbeingCheckpoint(record, now = new Date()) {
  const checkpoint = record?.checkpoint || null;
  const dueOn = record?.checkpointDueOn ? new Date(record.checkpointDueOn) : null;
  if (!checkpoint || !dueOn || Number.isNaN(dueOn.getTime())) {
    return { hasCheckpoint: false, dueOn: null, isDue: false, followUpState: null, needsFollowUp: false };
  }
  const followUpState = checkpoint.followUp?.state || null;
  const isDue = dueOn.getTime() <= now.getTime();
  return {
    hasCheckpoint: true,
    dueOn,
    isDue,
    followUpState,
    needsFollowUp: isDue && !followUpState
  };
}
