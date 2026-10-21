let globalData = null;
let currentViewMode = 'heatmap_dots'; // 'heatmap_dots', 'dots_only', 'zones'
let currentContactFilter = 'all'; // 'all', 'hard_hit', 'hits'
let barrelFilterActive = false;
let activePlayer = null;

const tooltip = document.getElementById('globalTooltip');

// Coordinate bounds for Strike Zone chart (feet)
const COORD_BOUNDS = {
    minX: -1.6,
    maxX: 1.6,
    minZ: 0.7,
    maxZ: 4.1
};

// ========================================================
// INITIALIZATION & EVENT LISTENERS
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Auto-load sample data on startup for immediate presentation readiness
    loadSampleData();
});

function setupEventListeners() {
    // Quick load buttons
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    if (quickLoadBtn) quickLoadBtn.addEventListener('click', loadSampleData);
    
    const promptLoadBtn = document.getElementById('promptLoadBtn');
    if (promptLoadBtn) promptLoadBtn.addEventListener('click', loadSampleData);

    // Toggle custom upload inputs
    const toggleUploadBtn = document.getElementById('toggleUploadBtn');
    const uploadForm = document.getElementById('uploadForm');
    const toggleUploadText = document.getElementById('toggleUploadText');
    const toggleUploadIcon = document.getElementById('toggleUploadIcon');
    
    if (toggleUploadBtn) {
        toggleUploadBtn.addEventListener('click', () => {
            const isHidden = uploadForm.classList.contains('hidden');
            if (isHidden) {
                uploadForm.classList.remove('hidden');
                toggleUploadText.textContent = 'Hide CSV Upload Inputs';
                toggleUploadIcon.classList.add('rotate-180');
            } else {
                uploadForm.classList.add('hidden');
                toggleUploadText.textContent = 'Show CSV Upload Inputs';
                toggleUploadIcon.classList.remove('rotate-180');
            }
        });
    }

    // Custom upload form
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleCustomUpload);
    }

    // Player select dropdown
    const playerSelect = document.getElementById('playerSelect');
    if (playerSelect) {
        playerSelect.addEventListener('change', (e) => {
            selectPlayer(e.target.value);
        });
    }

    // Prev / Next player buttons
    const prevPlayerBtn = document.getElementById('prevPlayerBtn');
    const nextPlayerBtn = document.getElementById('nextPlayerBtn');
    if (prevPlayerBtn) prevPlayerBtn.addEventListener('click', () => cyclePlayer(-1));
    if (nextPlayerBtn) nextPlayerBtn.addEventListener('click', () => cyclePlayer(1));

    // Keyboard navigation (Left/Right arrow) for slick presentation flow
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.key === 'ArrowLeft') cyclePlayer(-1);
        if (e.key === 'ArrowRight') cyclePlayer(1);
    });

    // Active Barrel Toggle Button
    const barrelToggleBtn = document.getElementById('barrelToggleBtn');
    if (barrelToggleBtn) {
        barrelToggleBtn.addEventListener('click', () => {
            toggleBarrelFilter();
        });
    }

    // View mode toggle buttons
    const viewButtons = [
        { id: 'viewHeatmapDots', mode: 'heatmap_dots' },
        { id: 'viewDotsOnly', mode: 'dots_only' },
        { id: 'viewZonesOnly', mode: 'zones' }
    ];

    viewButtons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (el) {
            el.addEventListener('click', () => {
                currentViewMode = btn.mode;
                viewButtons.forEach(b => {
                    const bEl = document.getElementById(b.id);
                    if (b.mode === currentViewMode) {
                        bEl.className = 'view-mode-btn px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-white transition-all cursor-pointer';
                    } else {
                        bEl.className = 'view-mode-btn px-2.5 py-1 text-xs font-semibold rounded-md text-slate-400 hover:text-white transition-all cursor-pointer';
                    }
                });
                renderCurrentPlayerHeatmap();
            });
        }
    });

    // Contact filter buttons
    const filterButtons = [
        { id: 'filterAll', filter: 'all' },
        { id: 'filterHardHit', filter: 'hard_hit' },
        { id: 'filterHits', filter: 'hits' }
    ];

    filterButtons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (el) {
            el.addEventListener('click', () => {
                currentContactFilter = btn.filter;
                filterButtons.forEach(b => {
                    const bEl = document.getElementById(b.id);
                    if (b.filter === currentContactFilter) {
                        bEl.className = 'filter-btn px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-slate-700 text-white border border-slate-600 transition-all cursor-pointer';
                    } else {
                        bEl.className = 'filter-btn px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-dark text-slate-400 border border-slate-800 hover:text-white transition-all cursor-pointer';
                    }
                });
                renderCurrentPlayerHeatmap();
            });
        }
    });

    // Resize observer
    window.addEventListener('resize', debounce(() => {
        if (activePlayer) {
            renderCurrentPlayerHeatmap();
            renderCurrentPlayerLaunchAngle();
        }
    }, 150));
}

function toggleBarrelFilter() {
    barrelFilterActive = !barrelFilterActive;
    const btn = document.getElementById('barrelToggleBtn');
    if (btn) {
        if (barrelFilterActive) {
            btn.className = 'px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 bg-amber-500 text-slate-950 border border-amber-400 shadow-md shadow-amber-500/30 cursor-pointer scale-105';
        } else {
            btn.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer shadow-sm';
        }
    }
    renderCurrentPlayerLaunchAngle();
}

// ========================================================
// DATA LOADING (FAILSAFE DUAL-ORIGIN + CLIENT FALLBACK)
// ========================================================
async function loadSampleData() {
    const errorEl = document.getElementById('uploadError');
    if (errorEl) errorEl.classList.add('hidden');
    
    showLoader(true, 'Loading Roster...');
    
    const endpoints = [
        'http://127.0.0.1:8000/api/sample',
        'http://localhost:8000/api/sample'
    ];
    
    let loadedData = null;
    
    for (const url of endpoints) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const json = await res.json();
                if (!json.error && json.players && json.players.length > 0) {
                    loadedData = json;
                    break;
                }
            }
        } catch (e) {
            // continue to next endpoint
        }
    }
    
    // If backend endpoints couldn't be reached, fallback to client-side CSV processing
    if (!loadedData) {
        try {
            loadedData = await processLocalCsvFallback();
        } catch (e) {
            console.error('Client CSV fallback failed:', e);
        }
    }
    
    if (loadedData) {
        initDashboardWithData(loadedData);
    } else {
        if (errorEl) {
            errorEl.textContent = 'Could not load dataset. Ensure server is running or refresh.';
            errorEl.classList.remove('hidden');
        }
    }
    
    showLoader(false);
}

// Client-side fallback that parses local CSVs directly if backend is blocked
async function processLocalCsvFallback() {
    const [collegeRows, mlbRows] = await Promise.all([
        d3.csv('college_mock.csv'),
        d3.csv('mlb_mock.csv')
    ]);
    
    if (!collegeRows || collegeRows.length === 0) return null;
    
    // MLB Benchmarks
    const mlbBatters = d3.group(mlbRows, d => d.batter || 'MLB');
    const mlbAvgEvs = [];
    const mlbMaxEvs = [];
    const mlbHhPcts = [];
    const mlbSsPcts = [];
    
    mlbBatters.forEach(rows => {
        const evs = rows.map(r => +r.launch_speed).filter(v => !isNaN(v));
        const las = rows.map(r => +r.launch_angle).filter(v => !isNaN(v));
        if (evs.length > 0) {
            mlbAvgEvs.push(d3.mean(evs));
            mlbMaxEvs.push(d3.max(evs));
            mlbHhPcts.push((evs.filter(v => v >= 95).length / evs.length) * 100);
            mlbSsPcts.push(las.length > 0 ? (las.filter(v => v >= 8 && v <= 32).length / las.length) * 100 : 33);
        }
    });
    
    // College Batters
    const collegeBatters = d3.group(collegeRows, d => d.batter);
    const players = Array.from(collegeBatters.keys()).sort();
    const resultData = {};
    const hitEvents = new Set(['single', 'double', 'triple', 'home_run']);
    
    players.forEach(pName => {
        const rows = collegeBatters.get(pName);
        const pNum = rows[0].batter_num ? +rows[0].batter_num : 24;
        const pPos = rows[0].batter_pos || 'OF';
        const pArch = rows[0].batter_archetype || 'Hitter';
        
        const pitches = rows.map(r => {
            const ev = +r.launch_speed || 0;
            const la = +r.launch_angle || 0;
            const isHit = hitEvents.has((r.events || '').toLowerCase());
            const isHh = ev >= 95.0;
            const isSs = la >= 8.0 && la <= 32.0;
            const isBarrel = isHh && isSs;
            return {
                x: +r.plate_x || 0,
                z: +r.plate_z || 2.5,
                ev,
                la,
                zone: +r.zone || 5,
                event: r.events || 'field_out',
                pitch_type: r.pitch_type || 'Fastball',
                is_hit: isHit,
                is_hard_hit: isHh,
                is_sweet_spot: isSs,
                is_barrel: isBarrel
            };
        });
        
        // 3x3 Zones
        const zoneData = [];
        for (let z = 1; z <= 9; z++) {
            const zBip = pitches.filter(pt => pt.zone === z);
            const total = zBip.length;
            const hardHits = zBip.filter(pt => pt.is_hard_hit).length;
            zoneData.push({
                zone: z,
                hardHitRate: total > 0 ? hardHits / total : 0,
                total,
                hardHits,
                avgEv: total > 0 ? +(d3.mean(zBip, pt => pt.ev).toFixed(1)) : 0,
                avgLa: total > 0 ? +(d3.mean(zBip, pt => pt.la).toFixed(1)) : 0
            });
        }
        
        const validEvs = pitches.map(pt => pt.ev).filter(v => v > 0);
        const avgEv = d3.mean(validEvs) || 0;
        const maxEv = d3.max(validEvs) || 0;
        const hhPct = (pitches.filter(pt => pt.is_hard_hit).length / pitches.length) * 100;
        const ssPct = (pitches.filter(pt => pt.is_sweet_spot).length / pitches.length) * 100;
        const avgLa = d3.mean(pitches.map(pt => pt.la)) || 0;
        const hits = pitches.filter(pt => pt.is_hit).length;
        const outs = pitches.length - hits;
        const hrs = pitches.filter(pt => (pt.event || '').toLowerCase() === 'home_run').length;
        const barrels = pitches.filter(pt => pt.is_barrel).length;
        
        // Percentile calculator
        const getPct = (arr, val) => {
            const count = arr.filter(v => v <= val).length;
            return +((count / arr.length) * 100).toFixed(1);
        };
        
        resultData[pName] = {
            meta: { num: pNum, pos: pPos, archetype: pArch },
            summary: {
                total_bip: pitches.length,
                avg_ev: +avgEv.toFixed(1),
                max_ev: +maxEv.toFixed(1),
                hard_hit_pct: +hhPct.toFixed(1),
                sweet_spot_pct: +ssPct.toFixed(1),
                avg_la: +avgLa.toFixed(1),
                hits,
                outs,
                home_runs: hrs,
                barrels,
                babip: +(hits / pitches.length).toFixed(3)
            },
            pitches,
            zoneData,
            percentiles: {
                avg_ev: { value: +avgEv.toFixed(1), percentile: getPct(mlbAvgEvs, avgEv) },
                max_ev: { value: +maxEv.toFixed(1), percentile: getPct(mlbMaxEvs, maxEv) },
                hard_hit_pct: { value: +hhPct.toFixed(1), percentile: getPct(mlbHhPcts, hhPct) },
                sweet_spot: { value: +ssPct.toFixed(1), percentile: getPct(mlbSsPcts, ssPct) }
            },
            laDist: {
                hits: pitches.filter(pt => pt.is_hit).map(pt => ({ la: pt.la, ev: pt.ev, event: pt.event, is_barrel: pt.is_barrel })),
                outs: pitches.filter(pt => !pt.is_hit).map(pt => ({ la: pt.la, ev: pt.ev, event: pt.event, is_barrel: pt.is_barrel }))
            }
        };
    });
    
    return {
        players,
        data: resultData,
        mlb_sample_size: mlbAvgEvs.length
    };
}

async function handleCustomUpload(e) {
    e.preventDefault();
    const mlbFile = document.getElementById('mlbFile').files[0];
    const collegeFile = document.getElementById('collegeFile').files[0];
    const errorEl = document.getElementById('uploadError');
    
    if (errorEl) errorEl.classList.add('hidden');
    
    if (!mlbFile || !collegeFile) {
        if (errorEl) {
            errorEl.textContent = 'Please select both MLB Statcast and College CSV files.';
            errorEl.classList.remove('hidden');
        }
        return;
    }
    
    showLoader(true, 'Processing CSVs...');
    
    const formData = new FormData();
    formData.append('mlb_file', mlbFile);
    formData.append('college_file', collegeFile);
    
    try {
        const response = await fetch('http://127.0.0.1:8000/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        initDashboardWithData(data);
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = err.message || 'Error occurred during processing.';
            errorEl.classList.remove('hidden');
        }
    } finally {
        showLoader(false);
    }
}

function showLoader(isLoading, text = 'Processing...') {
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    if (btnText) btnText.textContent = isLoading ? text : 'Analyze Files';
    if (btnLoader) {
        if (isLoading) btnLoader.classList.remove('hidden');
        else btnLoader.classList.add('hidden');
    }
}

function initDashboardWithData(data) {
    globalData = data;
    
    // Update header badge
    const badge = document.getElementById('datasetBadge');
    const badgeText = document.getElementById('datasetBadgeText');
    if (badge && badgeText) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        const nPlayers = data.players ? data.players.length : 0;
        const nBench = data.mlb_sample_size || 141;
        badgeText.textContent = `${nPlayers} College Batters • ${nBench} MLB Benchmarks`;
    }

    // Populate dropdown
    const select = document.getElementById('playerSelect');
    if (select) {
        select.innerHTML = '';
        data.players.forEach((p, idx) => {
            const pMeta = (data.data[p] && data.data[p].meta) || {};
            const numStr = pMeta.num ? `#${pMeta.num}` : '';
            const posStr = pMeta.pos ? `(${pMeta.pos})` : '';
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = `${idx + 1}. ${p} ${numStr} ${posStr}`.trim();
            select.appendChild(opt);
        });
    }

    // Reveal dashboard
    const prompt = document.getElementById('initialPrompt');
    if (prompt) prompt.classList.add('hidden');

    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.classList.remove('hidden');
        dashboard.classList.add('flex');
        setTimeout(() => dashboard.classList.remove('opacity-0'), 50);
    }

    // Select default player (prefer 'Lucas Vance' if present, else first)
    const defaultPlayer = data.players.includes('Lucas Vance') ? 'Lucas Vance' : data.players[0];
    requestAnimationFrame(() => {
        selectPlayer(defaultPlayer);
    });
}

// ========================================================
// ACTIVE PLAYER SPOTLIGHT HEADER & CONTROLS
// ========================================================
function cyclePlayer(offset) {
    if (!globalData || !globalData.players || globalData.players.length === 0) return;
    const currentIndex = globalData.players.indexOf(activePlayer);
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex + offset;
    if (nextIndex < 0) nextIndex = globalData.players.length - 1;
    if (nextIndex >= globalData.players.length) nextIndex = 0;
    
    selectPlayer(globalData.players[nextIndex]);
}

function selectPlayer(playerName) {
    if (!globalData || !globalData.data[playerName]) return;
    activePlayer = playerName;
    
    // Sync select dropdown
    const select = document.getElementById('playerSelect');
    if (select) select.value = playerName;

    const pData = globalData.data[playerName];
    const s = pData.summary || {};
    const meta = pData.meta || {};
    
    const playerIndex = globalData.players.indexOf(playerName) + 1;
    const totalPlayers = globalData.players.length;

    // ACTIVE SPOTLIGHT HEADER CARD UPDATES
    updateElementText('spotlightPlayerName', playerName);
    updateElementText('spotlightPlayerNumPos', `#${meta.num || 24} • ${meta.pos || 'OF'}`);
    updateElementText('spotlightPlayerArchetype', meta.archetype || 'Hitter Profile');
    updateElementText('spotlightPlayerIndex', `Player ${playerIndex} of ${totalPlayers} on College Roster`);

    // Spotlight Stats Badges
    updateElementText('spotlightBip', s.total_bip || 0);
    updateElementText('spotlightHh', `${(s.hard_hit_pct || 0).toFixed(1)}%`);
    updateElementText('spotlightAvgEv', `${(s.avg_ev || 0).toFixed(1)}`);
    updateElementText('spotlightMaxEv', `${(s.max_ev || 0).toFixed(1)}`);
    updateElementText('spotlightSs', `${(s.sweet_spot_pct || 0).toFixed(1)}%`);
    updateElementText('spotlightBarrels', s.barrels || 0);
    updateElementText('spotlightHits', `${s.hits || 0} (${s.home_runs || 0} HR)`);

    // Reset barrel filter on player switch
    barrelFilterActive = false;
    const barrelBtn = document.getElementById('barrelToggleBtn');
    if (barrelBtn) {
        barrelBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer shadow-sm';
    }

    // Render charts
    renderCurrentPlayerHeatmap();
    drawSliders(pData.percentiles || {});
    renderCurrentPlayerLaunchAngle();
}

function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ========================================================
// COOL-TONED NON-RIGID HEATMAP & PITCH DOTS
// ========================================================
function renderCurrentPlayerHeatmap() {
    if (!activePlayer || !globalData) return;
    const pData = globalData.data[activePlayer];
    if (!pData) return;

    const container = document.getElementById('heatmapContainer');
    const canvas = document.getElementById('heatmapCanvas');
    const svgEl = document.getElementById('heatmapSvg');
    if (!container || !canvas || !svgEl) return;

    const rect = container.getBoundingClientRect();
    const width = (rect && rect.width > 50) ? rect.width : (container.clientWidth > 50 ? container.clientWidth : 360);
    const height = (rect && rect.height > 50) ? rect.height : (container.clientHeight > 50 ? container.clientHeight : 450);

    // Retina-sharp Canvas setup
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Coordinate Mapping Scales
    const scaleX = (x) => ((x - COORD_BOUNDS.minX) / (COORD_BOUNDS.maxX - COORD_BOUNDS.minX)) * width;
    const scaleZ = (z) => height - ((z - COORD_BOUNDS.minZ) / (COORD_BOUNDS.maxZ - COORD_BOUNDS.minZ)) * height;

    // Filter pitches
    let pitches = pData.pitches || [];
    if (currentContactFilter === 'hard_hit') {
        pitches = pitches.filter(p => p.is_hard_hit);
    } else if (currentContactFilter === 'hits') {
        pitches = pitches.filter(p => p.is_hit);
    }

    // 1. Draw Thermal Density Layer on Canvas (COOL PALETTE: Indigo, Sky Blue, Cyan, Mint)
    if (currentViewMode === 'heatmap_dots' || currentViewMode === 'zones') {
        ctx.globalCompositeOperation = 'source-over';
        
        // Deep Midnight Navy background fill
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0a0f1e');
        bgGrad.addColorStop(1, '#050811');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Vibrant Glowing Cool Thermal Blobs
        ctx.globalCompositeOperation = 'lighter';
        
        const heatPitches = (pData.pitches || []).filter(p => p.ev >= 82.0);
        const radius = Math.max(38, width * 0.16);

        heatPitches.forEach(p => {
            const cx = scaleX(p.x);
            const cy = scaleZ(p.z);
            
            // Higher intensity so clouds are clearly visible
            let intensity = p.is_hard_hit ? 0.65 : 0.32;
            if (p.is_hard_hit && p.ev >= 100) intensity = 0.85;

            const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            
            // VIVID COOL PALETTE: Electric Indigo core -> Sky Blue mid -> Mint outer
            if (p.is_hard_hit) {
                radGrad.addColorStop(0, `rgba(99, 102, 241, ${intensity})`);          // Electric Indigo (#6366f1)
                radGrad.addColorStop(0.35, `rgba(56, 189, 248, ${intensity * 0.75})`); // Sky Cyan (#38bdf8)
                radGrad.addColorStop(0.7, `rgba(45, 212, 191, ${intensity * 0.35})`);  // Cool Mint (#2dd4bf)
                radGrad.addColorStop(1, 'rgba(10, 15, 30, 0)');
            } else {
                radGrad.addColorStop(0, `rgba(56, 189, 248, ${intensity * 0.75})`); // Cyan
                radGrad.addColorStop(0.5, `rgba(99, 102, 241, ${intensity * 0.35})`); // Deep Indigo
                radGrad.addColorStop(1, 'rgba(10, 15, 30, 0)');
            }

            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        });
    } else {
        // Clean deep slate background for "Dots Only"
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0c1322');
        bgGrad.addColorStop(1, '#060a13');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw SVG Layer (Strike Zone, Home Plate, Pitch Dots, Zone Stats)
    const svg = d3.select('#heatmapSvg');
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    // Strike Zone Physical Box: x in [-0.83, 0.83], z in [1.5, 3.5]
    const szLeft = scaleX(-0.83);
    const szRight = scaleX(0.83);
    const szTop = scaleZ(3.5);
    const szBottom = scaleZ(1.5);
    const szW = szRight - szLeft;
    const szH = szBottom - szTop;

    // Home Plate Polygon at bottom
    const hpTopZ = scaleZ(1.15);
    const hpMidZ = scaleZ(0.98);
    const hpBottomZ = scaleZ(0.85);
    const hpLeftX = scaleX(-0.71);
    const hpRightX = scaleX(0.71);
    const hpCenterX = scaleX(0.0);

    const platePoints = [
        `${hpLeftX},${hpTopZ}`,
        `${hpRightX},${hpTopZ}`,
        `${hpRightX},${hpMidZ}`,
        `${hpCenterX},${hpBottomZ}`,
        `${hpLeftX},${hpMidZ}`
    ].join(' ');

    // Home Plate Shape
    g.append('polygon')
        .attr('points', platePoints)
        .attr('fill', '#1e293b')
        .attr('stroke', '#475569')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9);

    g.append('text')
        .attr('x', hpCenterX)
        .attr('y', hpMidZ - 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '1px')
        .text('HOME PLATE');

    // Shadow / Chase boundary
    g.append('rect')
        .attr('x', scaleX(-1.35))
        .attr('y', scaleZ(3.9))
        .attr('width', scaleX(1.35) - scaleX(-1.35))
        .attr('height', scaleZ(1.1) - scaleZ(3.9))
        .attr('fill', 'none')
        .attr('stroke', '#334155')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.35);

    // Strike Zone Box (Transparent so thermal canvas clouds glow through)
    g.append('rect')
        .attr('x', szLeft)
        .attr('y', szTop)
        .attr('width', szW)
        .attr('height', szH)
        .attr('fill', 'none')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
        .attr('rx', 4);

    // 3x3 Internal Zone Gridlines
    const colStep = szW / 3;
    const rowStep = szH / 3;

    g.append('line')
        .attr('x1', szLeft + colStep).attr('y1', szTop)
        .attr('x2', szLeft + colStep).attr('y2', szBottom)
        .attr('stroke', '#64748b').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');

    g.append('line')
        .attr('x1', szLeft + colStep * 2).attr('y1', szTop)
        .attr('x2', szLeft + colStep * 2).attr('y2', szBottom)
        .attr('stroke', '#64748b').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');

    g.append('line')
        .attr('x1', szLeft).attr('y1', szTop + rowStep)
        .attr('x2', szRight).attr('y2', szTop + rowStep)
        .attr('stroke', '#64748b').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');

    g.append('line')
        .attr('x1', szLeft).attr('y1', szTop + rowStep * 2)
        .attr('x2', szRight).attr('y2', szTop + rowStep * 2)
        .attr('stroke', '#64748b').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');

    // Zone Numbers (1 to 9)
    const zonePositions = [
        { z: 1, c: 0, r: 0 }, { z: 2, c: 1, r: 0 }, { z: 3, c: 2, r: 0 },
        { z: 4, c: 0, r: 1 }, { z: 5, c: 1, r: 1 }, { z: 6, c: 2, r: 1 },
        { z: 7, c: 0, r: 2 }, { z: 8, c: 1, r: 2 }, { z: 9, c: 2, r: 2 }
    ];

    zonePositions.forEach(pos => {
        const zx = szLeft + pos.c * colStep + 6;
        const zy = szTop + pos.r * rowStep + 13;
        g.append('text')
            .attr('x', zx)
            .attr('y', zy)
            .attr('fill', '#475569')
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .text(pos.z);
    });

    // 3. Zone Breakdown Overlay (if in "3x3 Zones" mode, using cool tones)
    if (currentViewMode === 'zones') {
        const zoneData = pData.zoneData || [];
        const zoneMap = {};
        zoneData.forEach(zd => { zoneMap[zd.zone] = zd; });

        zonePositions.forEach(pos => {
            const zd = zoneMap[pos.z];
            if (!zd) return;

            const cellX = szLeft + pos.c * colStep;
            const cellY = szTop + pos.r * rowStep;

            const hhRate = zd.hardHitRate || 0;
            const fillAlpha = zd.total > 0 ? Math.min(0.65, 0.15 + hhRate * 0.5) : 0.05;
            // Cool palette fill: Indigo for high hard hit, Cyan for moderate
            const fillColor = hhRate >= 0.5 ? `rgba(99, 102, 241, ${fillAlpha})` : `rgba(56, 189, 248, ${fillAlpha})`;

            g.append('rect')
                .attr('x', cellX + 1)
                .attr('y', cellY + 1)
                .attr('width', colStep - 2)
                .attr('height', rowStep - 2)
                .attr('fill', fillColor)
                .attr('rx', 2);

            if (zd.total > 0) {
                g.append('text')
                    .attr('x', cellX + colStep / 2)
                    .attr('y', cellY + rowStep / 2 - 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', '#ffffff')
                    .attr('font-size', '14px')
                    .attr('font-weight', '800')
                    .text(`${(hhRate * 100).toFixed(0)}%`);

                g.append('text')
                    .attr('x', cellX + colStep / 2)
                    .attr('y', cellY + rowStep / 2 + 14)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#cbd5e1')
                    .attr('font-size', '10px')
                    .attr('font-weight', '600')
                    .text(`${zd.total} BIP • ${zd.avgEv} mph`);
            } else {
                g.append('text')
                    .attr('x', cellX + colStep / 2)
                    .attr('y', cellY + rowStep / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', '#64748b')
                    .attr('font-size', '12px')
                    .text('-');
            }
        });
    }

    // 4. Draw Individual Pitch Dots (Cool Indigo for Hard Hit, Ice Cyan for Contact)
    if (currentViewMode === 'heatmap_dots' || currentViewMode === 'dots_only') {
        const dotsG = g.append('g').attr('class', 'pitch-dots');

        dotsG.selectAll('circle.pitch-dot')
            .data(pitches)
            .enter()
            .append('circle')
            .attr('class', 'pitch-dot cursor-pointer transition-all')
            .attr('cx', d => scaleX(d.x))
            .attr('cy', d => scaleZ(d.z))
            .attr('r', d => d.is_hard_hit ? 5.5 : 4.5)
            // Hard Hit: Electric Indigo (#818cf8), Contact: Ice Cyan (#38bdf8)
            .attr('fill', d => d.is_hard_hit ? '#818cf8' : '#38bdf8')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.2)
            .attr('opacity', 0.95)
            .on('mouseenter', function(event, d) {
                d3.select(this)
                    .attr('r', 8.5)
                    .attr('stroke-width', 2.5)
                    .raise();
                    
                showTooltip(event, `
                    <div class="font-bold text-white text-xs mb-1 flex items-center justify-between gap-2">
                        <span>${d.event.replace('_', ' ').toUpperCase()}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${d.is_hard_hit ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}">
                            ${d.is_hard_hit ? '🔥 HARD HIT' : 'CONTACT'}
                        </span>
                    </div>
                    <div class="space-y-0.5 text-[11px] text-slate-300">
                        <div>Exit Velo: <strong class="text-white">${d.ev.toFixed(1)} mph</strong></div>
                        <div>Launch Angle: <strong class="text-white">${d.la.toFixed(1)}°</strong></div>
                        ${d.is_barrel ? '<div class="text-amber-400 font-bold">🎯 STATCAST BARREL</div>' : ''}
                        <div>Pitch: <span class="text-slate-400">${d.pitch_type}</span></div>
                        <div class="text-[10px] text-slate-400 pt-0.5 border-t border-slate-700/60 mt-1">
                            Zone ${d.zone} • (x: ${d.x}, z: ${d.z})
                        </div>
                    </div>
                `);
            })
            .on('mouseleave', function(event, d) {
                d3.select(this)
                    .attr('r', d.is_hard_hit ? 5.5 : 4.5)
                    .attr('stroke-width', 1.2);
                hideTooltip();
            });
    }
}

// ========================================================
// MLB PERCENTILE RANKINGS (SAVANT SLIDERS)
// ========================================================
function getOrdinalSuffix(n) {
    let ord = 'th';
    if (n % 10 == 1 && n % 100 != 11) ord = 'st';
    else if (n % 10 == 2 && n % 100 != 12) ord = 'nd';
    else if (n % 10 == 3 && n % 100 != 13) ord = 'rd';
    return ord;
}

function drawSliders(percentiles) {
    const container = document.getElementById('slidersContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const metrics = [
        { id: 'avg_ev', name: 'Average Exit Velocity', unit: 'mph', desc: 'Average velocity of all batted balls in play' },
        { id: 'max_ev', name: 'Max Exit Velocity', unit: 'mph', desc: 'Peak exit speed recorded this season' },
        { id: 'hard_hit_pct', name: 'Hard Hit %', unit: '%', desc: 'Percentage of batted balls hit at 95+ mph' },
        { id: 'sweet_spot', name: 'Sweet Spot %', unit: '%', desc: 'Batted balls with launch angle 8°–32°' }
    ];
    
    metrics.forEach(m => {
        const data = percentiles[m.id];
        if (!data) return;
        
        const pct = Math.round(data.percentile);
        
        let fillGradient = 'bg-gradient-to-r from-sky-600 to-blue-500';
        let badgeColor = 'text-sky-400';
        
        if (pct >= 90) {
            fillGradient = 'bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-500/30';
            badgeColor = 'text-red-400';
        } else if (pct >= 70) {
            fillGradient = 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-md shadow-orange-500/20';
            badgeColor = 'text-orange-400';
        } else if (pct >= 40) {
            fillGradient = 'bg-gradient-to-r from-amber-500 to-yellow-400';
            badgeColor = 'text-yellow-400';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'group p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all';
        
        wrapper.innerHTML = `
            <div class="flex justify-between items-end mb-2.5">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-white block">${m.name}</span>
                        <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                            ${data.value.toFixed(1)} ${m.unit}
                        </span>
                    </div>
                    <span class="text-[11px] text-slate-500 block mt-0.5">${m.desc}</span>
                </div>
                <div class="text-right flex items-baseline gap-1">
                    <span class="text-2xl font-black ${badgeColor}">${pct}</span>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${getOrdinalSuffix(pct)}</span>
                </div>
            </div>
            
            <div class="savant-slider-track relative">
                <!-- 50th percentile (MLB average) tick marker -->
                <div class="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-500/40 z-10" title="MLB Average (50th)"></div>
                <!-- 90th percentile (Elite) tick marker -->
                <div class="absolute top-0 bottom-0 left-[90%] w-0.5 bg-red-400/30 z-10" title="MLB Elite (90th)"></div>
                <div class="savant-slider-fill ${fillGradient}" style="width: 0%"></div>
            </div>

            <div class="flex justify-between text-[10px] font-semibold text-slate-500 mt-1 px-0.5">
                <span>0</span>
                <span class="ml-auto mr-12 text-slate-400">MLB Median (50th)</span>
                <span>100</span>
            </div>
        `;
        
        container.appendChild(wrapper);
        
        setTimeout(() => {
            const fill = wrapper.querySelector('.savant-slider-fill');
            if (fill) fill.style.width = `${Math.max(3, pct)}%`;
        }, 60);
    });
}

// ========================================================
// LAUNCH ANGLE VS EXIT VELOCITY (ACTIVE BARREL ZONE)
// ========================================================
function renderCurrentPlayerLaunchAngle() {
    if (!activePlayer || !globalData) return;
    const pData = globalData.data[activePlayer];
    if (!pData) return;

    const laDist = pData.laDist || { hits: [], outs: [] };
    const container = document.getElementById('laContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const width = (container.clientWidth > 100) ? container.clientWidth : 800;
    const height = (container.clientHeight > 100) ? container.clientHeight : 450;
    
    const margin = { top: 30, right: 35, bottom: 50, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    
    const svg = d3.select('#laContainer')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('display', 'block')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
        
    const hits = laDist.hits || [];
    const outs = laDist.outs || [];
    const allData = [...hits, ...outs];
    
    // Barrel count: EV >= 95 and LA 8-32
    const barrelPitches = allData.filter(d => d.ev >= 95.0 && d.la >= 8.0 && d.la <= 32.0);
    const barrelCount = barrelPitches.length;
    
    updateElementText('laHitCount', `Hits: ${hits.length}`);
    updateElementText('laOutCount', `Outs: ${outs.length}`);
    updateElementText('laBarrelCount', `${barrelCount}`);
    
    if (allData.length === 0) {
        svg.append('text')
            .attr('x', innerW / 2)
            .attr('y', innerH / 2)
            .attr('fill', '#94a3b8')
            .attr('text-anchor', 'middle')
            .text('No batted ball launch angle data found');
        return;
    }
    
    const minLA = Math.min(-25, d3.min(allData, d => d.la) || -25);
    const maxLA = Math.max(65, d3.max(allData, d => d.la) || 65);
    const xScale = d3.scaleLinear().domain([minLA, maxLA]).range([0, innerW]).nice();
        
    const minEV = Math.min(60, d3.min(allData, d => d.ev) || 60);
    const maxEV = Math.max(115, d3.max(allData, d => d.ev) || 115);
    const yScale = d3.scaleLinear().domain([minEV, maxEV]).range([innerH, 0]).nice();

    // 1. Shaded Sweet Spot Corridor (8° to 32°)
    const ssLeft = xScale(8.0);
    const ssRight = xScale(32.0);
    svg.append('rect')
        .attr('x', ssLeft)
        .attr('y', 0)
        .attr('width', ssRight - ssLeft)
        .attr('height', innerH)
        .attr('fill', 'rgba(56, 189, 248, 0.06)')
        .attr('stroke', 'rgba(56, 189, 248, 0.20)')
        .attr('stroke-dasharray', '3,3');

    svg.append('text')
        .attr('x', (ssLeft + ssRight) / 2)
        .attr('y', 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#38bdf8')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.5px')
        .text('SWEET SPOT (8°–32°)');

    // 2. 95+ mph Hard Hit Threshold Line
    const hhY = yScale(95.0);
    svg.append('line')
        .attr('x1', 0).attr('y1', hhY)
        .attr('x2', innerW).attr('y2', hhY)
        .attr('stroke', '#818cf8')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.6);

    svg.append('text')
        .attr('x', innerW - 6)
        .attr('y', hhY - 6)
        .attr('text-anchor', 'end')
        .attr('fill', '#a5b4fc')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text('95 MPH HARD HIT THRESHOLD');

    // 3. ACTIVE BARREL ZONE BOX (Intersection of 8-32° and >=95 mph)
    // In D3 inverted scale, 95+ mph corresponds to y from 0 to hhY
    const barrelBox = svg.append('rect')
        .attr('class', 'barrel-zone cursor-pointer transition-all')
        .attr('x', ssLeft)
        .attr('y', 0)
        .attr('width', ssRight - ssLeft)
        .attr('height', Math.max(0, hhY))
        .attr('fill', barrelFilterActive ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.08)')
        .attr('stroke', barrelFilterActive ? '#f59e0b' : 'rgba(245, 158, 11, 0.4)')
        .attr('stroke-width', barrelFilterActive ? 2.5 : 1.5)
        .attr('stroke-dasharray', barrelFilterActive ? 'none' : '4,4')
        .attr('rx', 6)
        .on('mouseenter', function(event) {
            d3.select(this).attr('fill', 'rgba(245, 158, 11, 0.22)');
            showTooltip(event, `
                <div class="font-bold text-amber-400 text-xs">🎯 STATCAST BARREL ZONE</div>
                <div class="text-[11px] text-slate-300">EV ≥ 95 mph & Launch Angle 8°–32°</div>
                <div class="text-[10px] text-amber-300 font-semibold mt-1">Click to ${barrelFilterActive ? 'show all batted balls' : 'isolate barrels only'}!</div>
            `);
        })
        .on('mouseleave', function() {
            d3.select(this).attr('fill', barrelFilterActive ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.08)');
            hideTooltip();
        })
        .on('click', () => {
            toggleBarrelFilter();
        });

    svg.append('text')
        .attr('x', (ssLeft + ssRight) / 2)
        .attr('y', hhY / 2 + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fbbf24')
        .attr('font-size', '11px')
        .attr('font-weight', '800')
        .attr('opacity', 0.9)
        .attr('pointer-events', 'none')
        .text('🎯 BARREL ZONE');

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d => `${d}°`);
    svg.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .attr('color', '#475569')
        .call(g => g.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-weight', '600'));
        
    svg.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 36)
        .attr('fill', '#94a3b8')
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text('Launch Angle (degrees)');
        
    const yAxis = d3.axisLeft(yScale).ticks(7).tickFormat(d => `${d} mph`);
    svg.append('g')
        .call(yAxis)
        .attr('color', '#475569')
        .call(g => g.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-weight', '600'));
        
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -42)
        .attr('fill', '#94a3b8')
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text('Exit Velocity (mph)');

    // Scatter Dots - OUTS
    svg.selectAll('circle.out')
        .data(outs)
        .enter()
        .append('circle')
        .attr('class', 'out cursor-pointer transition-all')
        .attr('cx', d => xScale(d.la))
        .attr('cy', d => yScale(d.ev))
        .attr('r', d => (barrelFilterActive && d.is_barrel) ? 7.5 : 4.5)
        .attr('fill', '#ef4444')
        .attr('stroke', d => d.is_barrel ? '#f59e0b' : '#7f1d1d')
        .attr('stroke-width', d => d.is_barrel ? 2.5 : 1)
        .attr('opacity', d => {
            if (barrelFilterActive) return d.is_barrel ? 1.0 : 0.12;
            return 0.65;
        })
        .on('mouseenter', function(event, d) {
            d3.select(this).attr('r', 8.5).attr('opacity', 1).raise();
            showTooltip(event, `
                <div class="font-bold text-red-400 text-xs mb-0.5">OUT (${d.event.replace('_', ' ')})</div>
                <div class="text-[11px] text-slate-300">
                    EV: <strong class="text-white">${d.ev.toFixed(1)} mph</strong> • LA: <strong class="text-white">${d.la.toFixed(1)}°</strong>
                </div>
                ${d.is_barrel ? '<div class="text-amber-400 font-bold text-[10px] mt-1">🎯 STATCAST BARREL</div>' : ''}
            `);
        })
        .on('mouseleave', function(event, d) {
            const op = barrelFilterActive ? (d.is_barrel ? 1.0 : 0.12) : 0.65;
            d3.select(this).attr('r', (barrelFilterActive && d.is_barrel) ? 7.5 : 4.5).attr('opacity', op);
            hideTooltip();
        });

    // Scatter Dots - HITS
    svg.selectAll('circle.hit')
        .data(hits)
        .enter()
        .append('circle')
        .attr('class', 'hit cursor-pointer transition-all')
        .attr('cx', d => xScale(d.la))
        .attr('cy', d => yScale(d.ev))
        .attr('r', d => (barrelFilterActive && d.is_barrel) ? 8.0 : 5.5)
        .attr('fill', '#38bdf8')
        .attr('stroke', d => d.is_barrel ? '#f59e0b' : '#ffffff')
        .attr('stroke-width', d => d.is_barrel ? 2.5 : 1.5)
        .attr('opacity', d => {
            if (barrelFilterActive) return d.is_barrel ? 1.0 : 0.12;
            return 0.95;
        })
        .on('mouseenter', function(event, d) {
            d3.select(this).attr('r', 9.5).raise();
            showTooltip(event, `
                <div class="font-bold text-cyan-400 text-xs mb-0.5">HIT: ${d.event.replace('_', ' ').toUpperCase()}</div>
                <div class="text-[11px] text-slate-300">
                    EV: <strong class="text-white">${d.ev.toFixed(1)} mph</strong> • LA: <strong class="text-white">${d.la.toFixed(1)}°</strong>
                </div>
                ${d.is_barrel ? '<div class="text-amber-400 font-bold text-[10px] mt-1">🎯 STATCAST BARREL</div>' : ''}
            `);
        })
        .on('mouseleave', function(event, d) {
            const op = barrelFilterActive ? (d.is_barrel ? 1.0 : 0.12) : 0.95;
            d3.select(this).attr('r', (barrelFilterActive && d.is_barrel) ? 8.0 : 5.5).attr('opacity', op);
            hideTooltip();
        });
}

// ========================================================
// TOOLTIP & UTILITY HELPERS
// ========================================================
function showTooltip(event, htmlContent) {
    if (!tooltip) return;
    tooltip.innerHTML = htmlContent;
    tooltip.style.opacity = '1';
    
    const x = event.pageX + 14;
    const y = event.pageY - 34;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function hideTooltip() {
    if (!tooltip) return;
    tooltip.style.opacity = '0';
}

function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
