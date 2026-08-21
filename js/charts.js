'use strict';

const SERIES_COLORS = [
  '#00f2fe', '#4facfe', '#00f5a0', '#f6d365',
  '#ff4b72', '#a34ef1', '#f1a34e', '#ff9a9e'
];

class SharedViewport {
  constructor(tMin, tMax) {
    this._totalMin = isFinite(tMin) ? tMin : 0;
    this._totalMax = isFinite(tMax) && tMax > tMin ? tMax : this._totalMin + 1;
    this._tMin = this._totalMin;
    this._tMax = this._totalMax;
    this._subscribers = new Set();
    this._cursorTime = null;
    this._cursorSubscribers = new Set();
  }

  get tMin() { return this._tMin; }
  get tMax() { return this._tMax; }
  get totalMin() { return this._totalMin; }
  get totalMax() { return this._totalMax; }
  get span() { return Math.max(0.01, this._tMax - this._tMin); }
  get cursorTime() { return this._cursorTime; }

  setRange(tMin, tMax) {
    if (tMax - tMin < 0.1) {
      const center = (tMin + tMax) / 2;
      tMin = center - 0.05;
      tMax = center + 0.05;
    }
    
    if (tMin < this._totalMin) tMin = this._totalMin;
    if (tMax > this._totalMax) tMax = this._totalMax;
    if (tMin >= tMax) tMax = tMin + 0.1;

    this._tMin = tMin;
    this._tMax = tMax;
    this._notify();
  }

  reset() {
    this.setRange(this._totalMin, this._totalMax);
  }

  zoomAround(t, factor) {
    const leftSpan = t - this._tMin;
    const rightSpan = this._tMax - t;
    this.setRange(t - leftSpan * factor, t + rightSpan * factor);
  }

  pan(dtSec) {
    let newMin = this._tMin + dtSec;
    let newMax = this._tMax + dtSec;

    if (newMin < this._totalMin) {
      newMin = this._totalMin;
      newMax = newMin + this.span;
    }
    if (newMax > this._totalMax) {
      newMax = this._totalMax;
      newMin = newMax - this.span;
      if (newMin < this._totalMin) newMin = this._totalMin;
    }

    this.setRange(newMin, newMax);
  }

  setCursor(t) {
    this._cursorTime = t;
    for (const cb of this._cursorSubscribers) {
      cb(t);
    }
  }

  clearCursor() {
    this._cursorTime = null;
    for (const cb of this._cursorSubscribers) {
      cb(null);
    }
  }

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  subscribeCursor(callback) {
    this._cursorSubscribers.add(callback);
    return () => this._cursorSubscribers.delete(callback);
  }

  _notify() {
    for (const callback of this._subscribers) {
      callback();
    }
  }
}

class ChartPanel {
  constructor(container, viewport, series, options = {}) {
    this.container = container;
    this.viewport = viewport;
    this.series = series || [];
    this.options = Object.assign({
      title: '',
      yLabel: '',
      height: 160,
      pullRegions: [],
      highlights: []
    }, options);

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'chart-card-wrapper';
    this.wrapper.style.position = 'relative';
    this.wrapper.style.height = this.options.height + 'px';
    this.wrapper.style.width = '100%';
    this.wrapper.style.marginBottom = '12px';

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.background = '#0e111a';
    this.canvas.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    this.wrapper.appendChild(this.canvas);
    this.container.appendChild(this.wrapper);

    this.ctx = this.canvas.getContext('2d');
    this._legendRects = [];
    this._isDragging = false;
    this._lastMouseX = 0;

    this._setupEvents();

    this._unsubViewport = this.viewport.subscribe(() => this.draw());
    this._unsubCursor = this.viewport.subscribeCursor(() => this.draw());

    this.resizeObserver = new ResizeObserver(() => {
      this._resizeCanvas();
      this.draw();
    });
    this.resizeObserver.observe(this.wrapper);
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const rect = this.wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width > 0 ? rect.width : (this.wrapper.clientWidth || this.container.clientWidth || 600);
    const h = rect.height > 0 ? rect.height : (this.options.height || 160);
    this.canvas.width = Math.max(10, Math.floor(w * dpr));
    this.canvas.height = Math.max(10, Math.floor(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._width = w;
    this._height = h;
  }

  _setupEvents() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = this._pxToTime(x);
      const factor = e.deltaY > 0 ? 1.15 : 0.85;
      this.viewport.zoomAround(t, factor);
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      // Check legend click
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      for (const item of this._legendRects) {
        if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
          item.series.hidden = !item.series.hidden;
          this.draw();
          return;
        }
      }

      this._isDragging = true;
      this._lastMouseX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      if (this._isDragging) {
        const dx = e.clientX - this._lastMouseX;
        if (dx !== 0 && this._width > 0) {
          const dt = -dx * (this.viewport.span / this._width);
          this.viewport.pan(dt);
          this._lastMouseX = e.clientX;
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = this._pxToTime(x);
      this.viewport.setCursor(t);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.viewport.clearCursor();
    });

    window.addEventListener('mouseup', () => {
      this._isDragging = false;
    });

    this.canvas.addEventListener('dblclick', () => {
      this.viewport.reset();
    });
  }

  _pxToTime(px) {
    const margin = 45;
    const chartW = Math.max(1, this._width - margin * 2);
    const ratio = Math.max(0, Math.min(1, (px - margin) / chartW));
    return this.viewport.tMin + ratio * this.viewport.span;
  }

  _timeToPx(t) {
    const margin = 45;
    const chartW = Math.max(1, this._width - margin * 2);
    const ratio = (t - this.viewport.tMin) / this.viewport.span;
    return margin + ratio * chartW;
  }

  _valToPx(v, min, max) {
    const marginY = 24;
    const chartH = Math.max(1, this._height - marginY * 2);
    const range = (max - min) || 1;
    const ratio = (v - min) / range;
    return this._height - marginY - ratio * chartH;
  }

  _getYRange(axis) {
    let min = Infinity;
    let max = -Infinity;
    let hasData = false;

    for (const s of this.series) {
      if (s.hidden || (s.yAxis || 'left') !== axis) continue;
      if (!s.data) continue;

      for (const pt of s.data) {
        if (pt.t >= this.viewport.tMin - 0.2 && pt.t <= this.viewport.tMax + 0.2) {
          if (isFinite(pt.v)) {
            if (pt.v < min) min = pt.v;
            if (pt.v > max) max = pt.v;
            hasData = true;
          }
        }
      }
    }

    if (!hasData) {
      min = 0; max = 100;
    } else if (min === max) {
      min -= 1; max += 1;
    } else {
      const pad = (max - min) * 0.1;
      min -= pad;
      max += pad;
    }

    return { min, max, hasData };
  }

  draw() {
    const ctx = this.ctx;
    const w = this._width;
    const h = this._height;
    if (!ctx || !w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#111422');
    bgGrad.addColorStop(1, '#0b0d16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const hasRightAxis = this.series.some(s => s.yAxis === 'right' && !s.hidden);
    const leftRange = this._getYRange('left');
    const rightRange = this._getYRange('right');

    this._drawRegions();
    this._drawGridAndAxes(leftRange, rightRange, hasRightAxis);
    this._drawSeries(this.series, leftRange, rightRange);
    this._drawCursorAndTooltips(leftRange, rightRange);
    this._drawLegendAndTitle();
  }

  _drawRegions() {
    const ctx = this.ctx;
    const h = this._height;
    const pulls = this.options.pullRegions || [];

    for (const p of pulls) {
      const tStart = p.startTime !== undefined ? p.startTime : p.tStart;
      const tEnd = p.endTime !== undefined ? p.endTime : p.tEnd;
      if (tStart !== undefined && tEnd !== undefined) {
        const x1 = Math.max(45, this._timeToPx(tStart));
        const x2 = Math.min(this._width - 45, this._timeToPx(tEnd));
        if (x2 > x1) {
          ctx.fillStyle = 'rgba(0, 242, 254, 0.08)';
          ctx.fillRect(x1, 20, x2 - x1, h - 44);
          ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x1, 20, x2 - x1, h - 44);
        }
      }
    }
  }

  _drawGridAndAxes(leftRange, rightRange, hasRightAxis) {
    const ctx = this.ctx;
    const w = this._width;
    const h = this._height;
    const leftMargin = 45;
    const rightMargin = w - 45;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7a829e';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Horizontal grid & Left Y-labels
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const ratio = i / ySteps;
      const y = h - 24 - ratio * (h - 48);
      const val = leftRange.min + ratio * (leftRange.max - leftRange.min);

      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(rightMargin, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(Math.abs(val) < 10 ? 1 : 0), leftMargin - 6, y + 3);

      if (hasRightAxis) {
        const rVal = rightRange.min + ratio * (rightRange.max - rightRange.min);
        ctx.textAlign = 'left';
        ctx.fillText(rVal.toFixed(Math.abs(rVal) < 10 ? 1 : 0), rightMargin + 6, y + 3);
      }
    }

    // Time X-labels
    const span = this.viewport.span;
    let step = 1;
    if (span > 60) step = 10;
    else if (span > 30) step = 5;
    else if (span > 10) step = 2;
    else if (span < 2) step = 0.2;
    else if (span < 5) step = 0.5;

    const startT = Math.ceil(this.viewport.tMin / step) * step;
    ctx.textAlign = 'center';
    for (let t = startT; t <= this.viewport.tMax; t += step) {
      const x = this._timeToPx(t);
      if (x >= leftMargin && x <= rightMargin) {
        ctx.fillText(t.toFixed(step < 1 ? 1 : 0) + 's', x, h - 6);
      }
    }
  }

  _drawSeries(seriesList, leftRange, rightRange) {
    const ctx = this.ctx;
    const leftMargin = 45;
    const rightMargin = this._width - 45;

    for (const s of seriesList) {
      if (s.hidden || !s.data || s.data.length === 0) continue;

      const range = s.yAxis === 'right' ? rightRange : leftRange;
      if (!range.hasData) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(leftMargin, 16, rightMargin - leftMargin, this._height - 38);
      ctx.clip();

      ctx.beginPath();
      ctx.strokeStyle = s.color || '#00f2fe';
      ctx.lineWidth = s.width || 2;
      if (s.dashed) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);

      let started = false;
      for (let i = 0; i < s.data.length; i++) {
        const pt = s.data[i];
        if (pt.t < this.viewport.tMin - 0.5) continue;
        if (pt.t > this.viewport.tMax + 0.5) break;

        const x = this._timeToPx(pt.t);
        const y = this._valToPx(pt.v, range.min, range.max);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawCursorAndTooltips(leftRange, rightRange) {
    const t = this.viewport.cursorTime;
    if (t === null || t < this.viewport.tMin || t > this.viewport.tMax) return;

    const ctx = this.ctx;
    const x = this._timeToPx(t);
    const leftMargin = 45;
    const rightMargin = this._width - 45;

    if (x < leftMargin || x > rightMargin) return;

    // Vertical cursor line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(x, 20);
    ctx.lineTo(x, this._height - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // Find nearest points and draw dot + value
    let readoutY = 32;
    for (const s of this.series) {
      if (s.hidden || !s.data || s.data.length === 0) continue;
      const range = s.yAxis === 'right' ? rightRange : leftRange;

      // Find nearest data point
      let nearest = null;
      let minDiff = Infinity;
      for (const pt of s.data) {
        const diff = Math.abs(pt.t - t);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = pt;
        }
      }

      if (nearest && minDiff < 1.0) {
        const dotY = this._valToPx(nearest.v, range.min, range.max);
        ctx.fillStyle = s.color || '#00f2fe';
        ctx.beginPath();
        ctx.arc(x, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  _drawLegendAndTitle() {
    const ctx = this.ctx;
    const w = this._width;

    // Panel Title
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(this.options.title, 45, 14);

    // Interactive Legend
    this._legendRects = [];
    let curX = w - 50;

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    for (let i = this.series.length - 1; i >= 0; i--) {
      const s = this.series[i];
      const text = s.label || s.key;
      const textWidth = ctx.measureText(text).width;
      const itemW = textWidth + 24;
      curX -= itemW;

      this._legendRects.push({
        x: curX,
        y: 2,
        w: itemW,
        h: 18,
        series: s
      });

      // Indicator pill
      ctx.fillStyle = s.hidden ? 'rgba(100, 110, 130, 0.4)' : (s.color || '#00f2fe');
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(curX, 4, 10, 10, 3);
      } else {
        ctx.rect(curX, 4, 10, 10);
      }
      ctx.fill();

      // Label text
      ctx.fillStyle = s.hidden ? '#64748b' : '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(text, curX + 14, 13);
    }
  }

  destroy() {
    if (this._unsubViewport) this._unsubViewport();
    if (this._unsubCursor) this._unsubCursor();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

class ChartGroup {
  constructor(container, rows, pulls, columnDefs) {
    this.container = container;
    this.rows = rows || [];
    this.pulls = pulls || [];
    this.columnDefs = columnDefs || {};
    this.panels = [];

    let tMin = 0, tMax = 1;
    if (this.rows.length > 0) {
      const firstT = this.rows[0].time !== undefined ? this.rows[0].time : this.rows[0].Time;
      const lastT = this.rows[this.rows.length - 1].time !== undefined ? this.rows[this.rows.length - 1].time : this.rows[this.rows.length - 1].Time;
      tMin = isFinite(firstT) ? firstT : 0;
      tMax = isFinite(lastT) ? lastT : 1;
    }

    this.viewport = new SharedViewport(tMin, tMax);
    this._buildDefaultCharts();
  }

  _getSeriesData(key) {
    const data = [];
    if (!this.rows) return data;
    for (const row of this.rows) {
      const t = row.time !== undefined ? row.time : row.Time;
      const v = row[key];
      if (t !== undefined && v !== undefined && isFinite(v)) {
        data.push({ t, v });
      }
    }
    return data;
  }

  addChart(keys, options = {}) {
    const seriesList = [];
    let colorIdx = 0;

    const leftKeys = options.pairedKeys?.left || keys || [];
    const rightKeys = options.pairedKeys?.right || [];
    const allKeys = [...leftKeys, ...rightKeys];

    for (const key of allKeys) {
      const data = this._getSeriesData(key);
      if (data.length === 0) continue;

      let label = key;
      if (this.columnDefs[key] && this.columnDefs[key].name) {
        label = this.columnDefs[key].name;
      }

      const isRight = rightKeys.includes(key);
      seriesList.push({
        key,
        label,
        data,
        color: SERIES_COLORS[colorIdx % SERIES_COLORS.length],
        width: 2,
        dashed: false,
        yAxis: isRight ? 'right' : 'left',
        hidden: false
      });
      colorIdx++;
    }

    if (seriesList.length === 0) return null;

    const panelOptions = {
      title: options.title || '',
      height: options.height || 160,
      pullRegions: this.pulls
    };

    const panel = new ChartPanel(this.container, this.viewport, seriesList, panelOptions);
    this.panels.push(panel);
    return panel;
  }

  _buildDefaultCharts() {
    // 1. RPM & Boost
    const rpmBoost = this.addChart([], {
      title: 'Engine RPM & Boost Pressure (psi)',
      height: 180,
      pairedKeys: {
        left: ['rpm'],
        right: ['boost', 'boost_target']
      }
    });
    if (rpmBoost) {
      const bt = rpmBoost.series.find(s => s.key === 'boost_target');
      if (bt) bt.dashed = true;
    }

    // 2. Knock & Timing
    const knockPanel = this.addChart([], {
      title: 'Knock Retard (FBK / FKL) & DAM',
      height: 160,
      pairedKeys: {
        left: ['feedback_knock', 'fine_knock_learn'],
        right: ['dam']
      }
    });
    if (knockPanel) {
      const fkl = knockPanel.series.find(s => s.key === 'fine_knock_learn');
      if (fkl) fkl.dashed = true;
    }

    // 3. AFR & Commanded Fuel
    const afrPanel = this.addChart(['afr', 'comm_fuel_final'], {
      title: 'Air / Fuel Ratio (AFR) & Target',
      height: 150
    });
    if (afrPanel) {
      const comm = afrPanel.series.find(s => s.key === 'comm_fuel_final');
      if (comm) comm.dashed = true;
    }

    // 4. Fuel Rail Pressure & Injector Duty
    this.addChart([], {
      title: 'Fuel Rail Pressure (psi) & Injector Duty Cycle (%)',
      height: 150,
      pairedKeys: {
        left: ['fuel_press'],
        right: ['inj_duty_cycle']
      }
    });

    // 5. Temperatures (Intake & Oil)
    this.addChart([], {
      title: 'Charge Air (IAT) & Engine Oil Temperatures (°F)',
      height: 150,
      pairedKeys: {
        left: ['intake_temp', 'intake_temp_manifold'],
        right: ['oil_temp']
      }
    });

    // Draw all panels
    this.panels.forEach(p => p.draw());
  }

  zoomToPull(pull) {
    if (pull) {
      const tStart = pull.startTime !== undefined ? pull.startTime : pull.tStart;
      const tEnd = pull.endTime !== undefined ? pull.endTime : pull.tEnd;
      if (tStart !== undefined && tEnd !== undefined) {
        this.viewport.setRange(tStart - 0.5, tEnd + 0.5);
      }
    }
  }

  resetZoom() {
    this.viewport.reset();
  }

  destroy() {
    this.panels.forEach(p => p.destroy());
    this.panels = [];
  }
}

window.Charts = { SharedViewport, ChartPanel, ChartGroup, SERIES_COLORS };
