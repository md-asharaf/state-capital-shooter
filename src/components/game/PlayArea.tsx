import React from 'react';

interface Props {
  playAreaRef: React.RefObject<HTMLDivElement | null>;
  ballStates: { id: number; hidden: boolean; classes: string; x: number; y: number }[];
  trajectoryPoints: { x: number; y: number; r: number; fill: string }[];
  bulletPos: { x: number; y: number; visible: boolean };
}

export default function PlayArea({
  playAreaRef,
  ballStates,
  trajectoryPoints,
  bulletPos
}: Props) {
  return (
    <>
      <div id="play-area" ref={playAreaRef}>
        <div id="upper-wall"></div>
        {ballStates.map((b, i) => (
          <div
            key={b.id}
            id={`ball-${i}`}
            className={`ball color-${['red', 'green', 'gold', 'blue'][i]} ${b.classes} ${b.hidden ? 'hidden' : ''}`}
            style={{ left: b.x ? `${b.x}%` : undefined, top: b.y ? `${b.y}px` : undefined }}
          ></div>
        ))}
      </div>

      <svg id="trajectory-svg">
        {trajectoryPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.fill} />
        ))}
      </svg>

      <div id="bullet" className={!bulletPos.visible ? 'hidden' : ''} style={{ left: bulletPos.x, top: bulletPos.y }}></div>
    </>
  );
}
