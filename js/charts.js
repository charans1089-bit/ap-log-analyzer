'use strict';

const SERIES_COLORS = [
  '#4e9af1', '#f1a34e', '#4ef1a3', '#f14e9a',
  '#a34ef1', '#f1f14e', '#4ef1f1', '#f14e4e'
];

class SharedViewport {
  constructor(tMin, tMax) {
    this._totalMin = tMin;
    this._totalMax = tMax;
    this._tMin = tMin;
    this._tMax = tMax;
    this._subscribers = new Set();
  }

  get tMin() { return this._tMin; }
  get tMax() { return this._tMax; }
  get totalMin() { return this._totalMin; }
  get totalMax() { return this._totalMax; }
  get span() { return this._tMax - this._tMin; }

  setRange(tMin, tMax) {
    // Enforce min window of 0.1s
    if (tMax - tMin < 0.1) {
      const center = (tMin + tMax) / 2;
      tMin = center - 0.05;
      tMax = center + 0.05;
    }
    
    // Clamp to total bounds
    if (tMin < this._totalMin) tMin = this._totalMin;
    if (tMax > this._totalMax) tMax = this._totalMax;
    if (tMax > this._totalMax) {
        tMax = this._totalMax;
        if (tMax - tMin < 0.1) {
             tMin = tMax - 0.1;
             if (tMin < this._totalMin) tMin = this._totalMin;
        }
    }

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
      if(newMin < this._totalMin) newMin = this._totalMin;
    }

    this.setRange(newMin, newMax);
  }

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
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
      height: 150,
      pullRegions: [],
      highlights: []
    }, options);

    this.wrapper = document.createElement('div');
    this.wrapper.style.position = 'relative';
    this.wrapper.style.height = this.options.height + 'px';
    this.wrapper.style.width = '100%';
    this.wrapper.style.marginBottom = '10px';

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.wrapper.appendChild(this.canvas);
    this.container.appendChild(this.wrapper);

    this.ctx = this.canvas.getContext('2d');
    
    this.highlightRegion = null;
    this._isDragging = false;
    this._lastMouseX = 0;
    this._lastTouchDist = 0;
    
    this._setupEvents();
    
    this._unsubViewport = this.viewport.subscribe(() => this.draw());
    
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
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this._width = rect.width;
    this._height = rect.height;
  }

  _setupEvents() {
    // Mouse Events
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = this._pxToTime(x);
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      this.viewport.zoomAround(t, factor);
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this._lastMouseX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastMouseX;
      if (dx !== 0) {
        const dt = -dx * (this.viewport.span / this._width);
        this.viewport.pan(dt);
        this._lastMouseX = e.clientX;
      }
    });

    window.addEventListener('mouseup', () => {
      this._isDragging = false;
    });

    this.canvas.addEventListener('dblclick', () => {
      this.viewport.reset();
    });

    // Touch Events
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._isDragging = true;
        this._lastMouseX = e.touches[0].clientX;
      } else if (e.touches.length === 2) {
        this._isDragging = false;
        this._lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this._isDragging && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - this._lastMouseX;
        if (dx !== 0) {
          const dt = -dx * (this.viewport.span / this._width);
          this.viewport.pan(dt);
          this._lastMouseX = e.touches[0].clientX;
        }
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const centerClientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const rect = this.canvas.getBoundingClientRect();
        const centerX = centerClientX - rect.left;
        const t = this._pxToTime(centerX);
        
        if (this._lastTouchDist > 0) {
          const factor = this._lastTouchDist / dist;
          this.viewport.zoomAround(t, factor);
        }
        this._lastTouchDist = dist;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this._isDragging = false;
      this._lastTouchDist = 0;
    });
    
    // Legend click
    this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this._handleLegendClick(x, y);
    });
  }

  _pxToTime(px) {
    return this.viewport.tMin + (px / this._width) * this.viewport.span;
  }
  
  _timeToPx(t) {
    return ((t - this.viewport.tMin) / this.viewport.span) * this._width;
  }

  _valToPx(v, yMin, yMax, padTop = 15, padBottom = 20) {
    const range = yMax - yMin;
    const h = this._height - padTop - padBottom;
    if (range === 0) return padTop + h / 2;
    return padTop + h - ((v - yMin) / range) * h;
  }

  _getYRange(yAxis) {
    let min = Infinity;
    let max = -Infinity;
    let hasData = false;
    
    for (const s of this.series) {
      if (s.hidden || s.yAxis !== yAxis) continue;
      for (const pt of s.data) {
        if (pt.t >= this.viewport.tMin && pt.t <= this.viewport.tMax) {
          if (pt.v < min) min = pt.v;
          if (pt.v > max) max = pt.v;
          hasData = true;
        }
      }
    }
    
    if (!hasData) return { min: 0, max: 1, hasData: false };
    if (min === max) {
      if (min === 0) return { min: -1, max: 1, hasData: true };
      return { min: min * 0.9, max: max * 1.1, hasData: true };
    }
    
    const pad = (max - min) * 0.1;
    return { min: min - pad, max: max + pad, hasData: true };
  }

  addSeries(series) {
    if (!series.yAxis) series.yAxis = 'left';
    if (!series.width) series.width = 1.5;
    this.series.push(series);
    this.draw();
  }

  hideSeries(key, hidden) {
    const s = this.series.find(s => s.key === key);
    if (s) {
      s.hidden = hidden;
      this.draw();
    }
  }

  setHighlight(tStart, tEnd) {
    this.highlightRegion = { tStart, tEnd };
    this.draw();
  }

  destroy() {
    this._unsubViewport();
    this.resizeObserver.disconnect();
    this.container.removeChild(this.wrapper);
  }

  _drawGridAndAxes(leftRange, rightRange, hasRightAxis) {
    const ctx = this.ctx;
    const w = this._width;
    const h = this._height;
    const fontSize = w < 500 ? 10 : 11;
    
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';
    
    // Draw Zero Lines
    const drawZeroLine = (range) => {
        if (range.min < 0 && range.max > 0) {
            const y0 = this._valToPx(0, range.min, range.max);
            ctx.beginPath();
            ctx.moveTo(0, y0);
            ctx.lineTo(w, y0);
            ctx.strokeStyle = '#444466';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    };
    if (leftRange.hasData) drawZeroLine(leftRange);
    if (hasRightAxis && rightRange.hasData) drawZeroLine(rightRange);
    
    // Draw y-axis labels
    const drawYLabels = (range, isRight) => {
        if (!range.hasData) return;
        const xOffset = isRight ? w - 5 : 5;
        ctx.textAlign = isRight ? 'right' : 'left';
        ctx.fillStyle = '#8888aa';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const val = range.min + (range.max - range.min) * (i / steps);
            const y = this._valToPx(val, range.min, range.max);
            ctx.fillText(val.toFixed(1), xOffset, y);
        }
    };
    
    drawYLabels(leftRange, false);
    if (hasRightAxis) drawYLabels(rightRange, true);

    // Draw x-axis grid & labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#8888aa';
    
    const span = this.viewport.span;
    let step = 1;
    if (span > 100) step = 10;
    else if (span > 50) step = 5;
    else if (span > 10) step = 2;
    else if (span < 2) step = 0.2;
    else if (span < 5) step = 0.5;
    
    const startT = Math.ceil(this.viewport.tMin / step) * step;
    
    ctx.beginPath();
    ctx.strokeStyle = '#222234';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let t = startT; t <= this.viewport.tMax; t += step) {
        const x = this._timeToPx(t);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        if (x > 30 && x < w - 30) {
             ctx.fillText(t.toFixed(1) + 's', x, h - 2);
        }
    }
    ctx.stroke();
  }
  
  _drawRegions() {
      const h = this._height;
      const ctx = this.ctx;
      
      // Pull regions
      ctx.fillStyle = 'rgba(100,180,255,0.12)';
      for (const pull of this.options.pullRegions) {
          const x1 = Math.max(0, this._timeToPx(pull.tStart));
          const x2 = Math.min(this._width, this._timeToPx(pull.tEnd));
          if (x2 > x1) {
              ctx.fillRect(x1, 0, x2 - x1, h);
          }
      }
      
      // Highlights
      if (this.highlightRegion) {
          ctx.fillStyle = 'rgba(255,200,50,0.2)';
          const x1 = Math.max(0, this._timeToPx(this.highlightRegion.tStart));
          const x2 = Math.min(this._width, this._timeToPx(this.highlightRegion.tEnd));
          if (x2 > x1) {
              ctx.fillRect(x1, 0, x2 - x1, h);
          }
      }
  }
  
  _drawSeries(seriesList, leftRange, rightRange) {
      const ctx = this.ctx;
      const w = this._width;
      
      for (const s of seriesList) {
          if (s.hidden || !s.data || s.data.length === 0) continue;
          
          const range = s.yAxis === 'right' ? rightRange : leftRange;
          if (!range.hasData) continue;
          
          ctx.beginPath();
          ctx.strokeStyle = s.color || '#fff';
          ctx.lineWidth = s.width || 1.5;
          if (s.dashed) {
              ctx.setLineDash([5, 5]);
          } else {
              ctx.setLineDash([]);
          }
          
          let started = false;
          for (let i = 0; i < s.data.length; i++) {
              const pt = s.data[i];
              if (pt.t < this.viewport.tMin - 1) continue; // Small buffer before
              if (pt.t > this.viewport.tMax + 1) break;    // Small buffer after
              
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
      }
      ctx.setLineDash([]);
  }
  
  _drawLegendAndTitle() {
      const ctx = this.ctx;
      const w = this._width;
      
      // Title
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ccccee';
      ctx.fillText(this.options.title, 5, 5);
      
      // Legend
      this._legendRects = [];
      let xOffset = w - 5;
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'top';
      
      const reversedSeries = [...this.series].reverse(); // Draw right to left
      for (const s of reversedSeries) {
          const text = s.label;
          const textWidth = ctx.measureText(text).width;
          const totalItemWidth = 10 + 4 + textWidth + 10; // rect + pad + text + pad
          
          xOffset -= textWidth;
          ctx.fillStyle = s.hidden ? '#555' : '#ccccee';
          ctx.fillText(text, xOffset, 5);
          
          xOffset -= 14; // space for rect + pad
          ctx.fillStyle = s.hidden ? '#555' : s.color;
          ctx.fillRect(xOffset, 5, 10, 10);
          
          this._legendRects.push({
              key: s.key,
              x: xOffset,
              y: 5,
              w: 10 + 4 + textWidth,
              h: 10
          });
          
          xOffset -= 10; // gap before next item
      }
  }
  
  _handleLegendClick(x, y) {
      if (!this._legendRects) return;
      for (const rect of this._legendRects) {
          if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
              const s = this.series.find(s => s.key === rect.key);
              if (s) {
                  s.hidden = !s.hidden;
                  this.draw();
              }
              return;
          }
      }
  }

  draw() {
    if (!this.ctx || !this._width || !this._height) return;
    
    const w = this._width;
    const h = this._height;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, w, h);
    
    let hasDataAny = false;
    for (const s of this.series) {
        if (s.data && s.data.length > 0) hasDataAny = true;
    }

    if (!hasDataAny) {
        ctx.fillStyle = '#8888aa';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data', w / 2, h / 2);
        return;
    }

    const hasRightAxis = this.series.some(s => s.yAxis === 'right' && !s.hidden);
    const leftRange = this._getYRange('left');
    const rightRange = this._getYRange('right');

    this._drawRegions();
    this._drawGridAndAxes(leftRange, rightRange, hasRightAxis);
    this._drawSeries(this.series, leftRange, rightRange);
    this._drawLegendAndTitle();
  }
}

class ChartGroup {
  constructor(container, rows, pulls, columnDefs) {
    this.container = container;
    this.rows = rows;
    this.pulls = pulls || [];
    this.columnDefs = columnDefs || {};
    this.panels = [];
    
    let tMin = 0, tMax = 1;
    if (rows && rows.length > 0) {
      tMin = rows[0].Time;
      tMax = rows[rows.length - 1].Time;
    }
    
    this.viewport = new SharedViewport(tMin, tMax);
    this._buildDefaultCharts();
  }
  
  _getSeriesData(key) {
      const data = [];
      if (!this.rows) return data;
      for (const row of this.rows) {
          if (row[key] !== undefined && row.Time !== undefined) {
              data.push({ t: row.Time, v: row[key] });
          }
      }
      return data;
  }

  addChart(keys, options) {
    const seriesList = [];
    let colorIdx = 0;
    
    const leftKeys = options.pairedKeys?.left || keys;
    const rightKeys = options.pairedKeys?.right || [];
    const allKeys = [...leftKeys, ...rightKeys];
    
    for (const key of allKeys) {
        const data = this._getSeriesData(key);
        if (data.length === 0) continue; // omit if not present
        
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
            width: 1.5,
            dashed: false, // Default will override specifically in buildDefaultCharts if needed
            yAxis: isRight ? 'right' : 'left',
            hidden: false
        });
        colorIdx++;
    }
    
    if (seriesList.length === 0) return null; // Do not render empty panels
    
    const panelOptions = {
        title: options.title || '',
        height: options.height || 150,
        pullRegions: this.pulls
    };
    
    const panel = new ChartPanel(this.container, this.viewport, seriesList, panelOptions);
    this.panels.push(panel);
    return panel;
  }

  _buildDefaultCharts() {
      // 1. RPM
      this.addChart(['rpm'], { title: 'Engine Speed (RPM)', height: 120 });
      
      // 2. Boost vs Target & WG
      const boostPanel = this.addChart([], { 
          title: 'Boost / Wastegate', 
          height: 180,
          pairedKeys: {
              left: ['boost', 'boost_target'],
              right: ['wg_pos_comm', 'wg_pos_actual']
          }
      });
      if (boostPanel) {
          // Customize line styles
          const b = boostPanel.series.find(s => s.key === 'boost_target');
          if (b) b.dashed = true;
          const wg = boostPanel.series.find(s => s.key === 'wg_pos_comm');
          if (wg) wg.dashed = true;
      }
      
      // 3. AFR
      const afrPanel = this.addChart(['afr', 'comm_fuel_final'], { title: 'Air/Fuel Ratio', height: 150 });
      if (afrPanel) {
          const comm = afrPanel.series.find(s => s.key === 'comm_fuel_final');
          if (comm) comm.dashed = true;
      }
      
      // 4. Knock
      const knockPanel = this.addChart(['feedback_knock', 'fine_knock_learn'], { title: 'Knock Correction', height: 150 });
      if (knockPanel) {
          const fkl = knockPanel.series.find(s => s.key === 'fine_knock_learn');
          if (fkl) fkl.dashed = true;
      }
      
      // 5. DAM
      this.addChart(['dam'], { title: 'Dynamic Advance Multiplier (DAM)', height: 120 });
      
      // 6. Ethanol
      this.addChart(['ethanol_final'], { title: 'Ethanol Content (%)', height: 120 });
      
      // 7. KS Noise
      this.addChart(['ks_noise_cyl1', 'ks_noise_cyl2', 'ks_noise_cyl3', 'ks_noise_cyl4'], { title: 'Knock Sensor Noise', height: 150 });
      
      // 8. Temps
      const tempPanel = this.addChart([], {
          title: 'Temperatures',
          height: 150,
          pairedKeys: {
              left: ['intake_temp', 'coolant_temp'],
              right: ['oil_temp']
          }
      });
      if (tempPanel) {
          const coolant = tempPanel.series.find(s => s.key === 'coolant_temp');
          if (coolant) coolant.dashed = true;
      }
      
      // Initial draw
      this.panels.forEach(p => p.draw());
  }

  zoomToPull(pull) {
      if (pull) {
          this.viewport.setRange(pull.tStart - 0.5, pull.tEnd + 0.5);
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
