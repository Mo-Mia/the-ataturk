export const PITCH_WIDTH = 680;
export const PITCH_LENGTH = 1050;

export function PitchMarkings() {
  return (
    <>
      <rect x="0" y="0" width={PITCH_WIDTH} height={PITCH_LENGTH} fill="#2f7d48" />
      <PitchLineOverlay />
    </>
  );
}

export function PitchLineOverlay() {
  return (
    <>
      <rect
        x="8"
        y="8"
        width={PITCH_WIDTH - 16}
        height={PITCH_LENGTH - 16}
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <line
        x1="8"
        y1={PITCH_LENGTH / 2}
        x2={PITCH_WIDTH - 8}
        y2={PITCH_LENGTH / 2}
        stroke="#fff"
        strokeWidth="3"
      />
      <circle
        cx={PITCH_WIDTH / 2}
        cy={PITCH_LENGTH / 2}
        r="92"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <circle cx={PITCH_WIDTH / 2} cy={PITCH_LENGTH / 2} r="5" fill="#fff" />
      <rect x="140" y="8" width="400" height="165" fill="none" stroke="#fff" strokeWidth="3" />
      <rect x="248" y="8" width="184" height="56" fill="none" stroke="#fff" strokeWidth="3" />
      <rect
        x="140"
        y={PITCH_LENGTH - 173}
        width="400"
        height="165"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <rect
        x="248"
        y={PITCH_LENGTH - 64}
        width="184"
        height="56"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <line x1="295" y1="0" x2="385" y2="0" stroke="#fff" strokeWidth="7" />
      <line x1="295" y1={PITCH_LENGTH} x2="385" y2={PITCH_LENGTH} stroke="#fff" strokeWidth="7" />
    </>
  );
}
