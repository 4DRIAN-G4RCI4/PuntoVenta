import React, { useState } from 'react';
import { money } from '../format.js';

const PALETTE = ['#f5a623', '#4caf82', '#5b8def', '#e05263', '#9b6bd6', '#3fb6c9', '#d9a441', '#7f8fa6'];

export function GroupedBarChart({ series, labels, height = 240, valueFmt = money }) {
  const width = 640;
  const padL = 56, padB = 34, padT = 16, padR = 12;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = labels.length;
  const allVals = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allVals);
  const groupW = innerW / Math.max(1, n);
  const barGap = 4;
  const barW = Math.max(4, (groupW - barGap * (series.length + 1)) / series.length);

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => i / ticks);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ display: 'block', minWidth: width }}>
        {gridLines.map((t, i) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} fontSize="10" fill="var(--muted)" textAnchor="end">{valueFmt(max * t)}</text>
            </g>
          );
        })}
        {labels.map((lab, gi) => {
          const gx = padL + gi * groupW;
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const v = s.data[gi] || 0;
                const h = max > 0 ? (v / max) * innerH : 0;
                const x = gx + barGap + si * (barW + barGap);
                const y = padT + innerH - h;
                return (
                  <rect key={si} x={x} y={y} width={barW} height={h} fill={s.color || PALETTE[si % PALETTE.length]} rx="2">
                    <title>{s.name}: {valueFmt(v)}</title>
                  </rect>
                );
              })}
              <text x={gx + groupW / 2} y={height - padB + 16} fontSize="10" fill="var(--muted)" textAnchor="middle">{lab}</text>
            </g>
          );
        })}
        <line x1={padL} x2={width - padR} y1={padT + innerH} y2={padT + innerH} stroke="var(--border)" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color || PALETTE[i % PALETTE.length], display: 'inline-block' }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 220, valueFmt = money }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2;
  const rInner = r * 0.6;
  const cx = r, cy = r;
  let angle = -90;
  const [hover, setHover] = useState(null);

  if (!total) {
    return <p style={{ color: 'var(--muted)' }}>Sin datos.</p>;
  }

  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const startAngle = angle;
    const sweep = frac * 360;
    angle += sweep;
    const endAngle = angle;
    const toRad = (a) => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const large = sweep > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { path, color: PALETTE[i % PALETTE.length], ...d, frac };
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.color} opacity={hover === null || hover === i ? 1 : 0.35}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <title>{a.label}: {valueFmt(a.value)} ({(a.frac * 100).toFixed(1)}%)</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={rInner} fill="var(--surface, #1b1b1f)" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {arcs.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'default' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color, display: 'inline-block' }} />
            <span style={{ textTransform: 'capitalize', color: 'var(--text)' }}>{a.label}</span>
            <strong style={{ marginLeft: 'auto' }}>{valueFmt(a.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
