"use client";

import VoicePointAvatar from "./VoicePointAvatar";

/**
 * Sama punktikuju tavavestluse TAUSTAL: tuhm, liikumatu olekus, klikke mitte
 * püüdev. Tekstimullid seisavad tema ees.
 *
 * Renderdatakse ainult siis, kui häälreziim on kinni — kaks WebGL-konteksti
 * korraga oleks kaks korda joonistamist ilma ühegi kasuta.
 */
export default function VoiceAvatarBackdrop() {
  return <VoicePointAvatar backdrop status="idle" audioLevel={0} />;
}
