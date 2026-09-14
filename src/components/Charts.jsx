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
                  <rect
                    key={si} x={x} y={y} width={barW} height={h} fill={s.color || PALETTE[si % PALETTE.length]} rx="2"
                    className="pv-chart-bar" style={{ animationDelay: `${(gi * series.length + si) * 25}ms` }}
                  >
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
            className="pv-chart-arc" style={{ animationDelay: `${i * 60}ms` }}
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

/** Línea (o varias) con relleno opcional, trazo animado al aparecer y puntos
 * con tooltip nativo. Pensada para tendencias en el tiempo (ventas por día). */
export function LineChart({ series, labels, height = 220, valueFmt = money, area = true }) {
  const width = 640;
  const padL = 56, padB = 28, padT = 16, padR = 12;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = labels.length;
  const allVals = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allVals);
  const [hover, setHover] = useState(null);

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => i / ticks);
  const xAt = (i) => (n <= 1 ? padL : padL + (i / (n - 1)) * innerW);
  const yAt = (v) => padT + innerH - (max > 0 ? (v / max) * innerH : 0);

  if (n < 2) return <p style={{ color: 'var(--muted)' }}>Sin datos suficientes para graficar una tendencia.</p>;

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
        {series.map((s, si) => {
          const color = s.color || PALETTE[si % PALETTE.length];
          const pts = s.data.map((v, i) => [xAt(i), yAt(v)]);
          const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
          const areaPath = area ? `${linePath} L ${pts[pts.length - 1][0]} ${padT + innerH} L ${pts[0][0]} ${padT + innerH} Z` : null;
          return (
            <g key={si}>
              {area && <path d={areaPath} fill={color} opacity="0.12" />}
              <path
                d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="pv-chart-line" style={{ strokeDasharray: 3000, strokeDashoffset: 3000, animationDelay: `${si * 120}ms` }}
              />
              {pts.map(([x, y], i) => (
                <circle
                  key={i} cx={x} cy={y} r={hover?.si === si && hover?.i === i ? 5 : 3} fill={color}
                  className="pv-chart-dot" style={{ animationDelay: `${si * 120 + 700 + i * 15}ms` }}
                  onMouseEnter={() => setHover({ si, i })} onMouseLeave={() => setHover(null)}
                >
                  <title>{s.name} — {labels[i]}: {valueFmt(s.data[i])}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((lab, i) => (
          (n <= 12 || i % Math.ceil(n / 12) === 0) && (
            <text key={i} x={xAt(i)} y={height - padB + 16} fontSize="10" fill="var(--muted)" textAnchor="middle">{lab}</text>
          )
        ))}
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

/** Barras horizontales animadas con etiqueta de valor (y % opcional) al final
 * de cada barra — para rankings (departamentos, productos, lo que sea). */
export function HorizontalBarChart({ data, valueFmt = money, mostrarPct = false }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length) return <p style={{ color: 'var(--muted)' }}>Sin datos para mostrar.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (d.value / max) * 100 : 0;
        const pctTotal = total > 0 ? (d.value / total) * 100 : 0;
        const color = d.color || PALETTE[i % PALETTE.length];
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ textTransform: 'capitalize', color: 'var(--text)' }}>{d.label}</span>
              <strong>{valueFmt(d.value)}{mostrarPct ? ` · ${pctTotal.toFixed(1)}%` : ''}</strong>
            </div>
            <div className="pv-hbar-track" style={{ height: 10, borderRadius: 6, background: 'var(--surface2)' }}>
              <div
                className="pv-hbar-fill"
                style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: color, animationDelay: `${i * 60}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
