import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
from scipy import stats
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fallback zone centers if plate_x or plate_z are missing
ZONE_CENTERS = {
    1: (-0.55, 3.16), 2: (0.0, 3.16), 3: (0.55, 3.16),
    4: (-0.55, 2.50), 5: (0.0, 2.50), 6: (0.55, 2.50),
    7: (-0.55, 1.84), 8: (0.0, 1.84), 9: (0.55, 1.84),
    11: (-1.10, 3.30), 12: (1.10, 3.30), 13: (-1.10, 1.70), 14: (1.10, 1.70)
}

def process_dfs(mlb_df: pd.DataFrame, college_df: pd.DataFrame):
    mlb_df.columns = [c.lower() for c in mlb_df.columns]
    college_df.columns = [c.lower() for c in college_df.columns]
    
    # 1. MLB Benchmarking Population
    mlb_avg_evs = []
    mlb_max_evs = []
    mlb_hard_hit_pcts = []
    mlb_ss_pcts = []
    
    if 'launch_speed' in mlb_df.columns:
        if 'batter' in mlb_df.columns:
            def process_mlb_group(g):
                evs = g['launch_speed'].dropna()
                if len(evs) == 0:
                    return None
                avg_ev = evs.mean()
                max_ev = evs.max()
                hh_pct = (evs >= 95.0).mean() * 100.0
                
                if 'launch_angle' in g.columns:
                    las = g['launch_angle'].dropna()
                    ss_pct = ((las >= 8.0) & (las <= 32.0)).mean() * 100.0 if len(las) > 0 else 33.0
                else:
                    ss_pct = 33.0
                return pd.Series({
                    'avg_ev': avg_ev,
                    'max_ev': max_ev,
                    'hard_hit_pct': hh_pct,
                    'ss_pct': ss_pct
                })
                
            mlb_stats = mlb_df.groupby('batter').apply(process_mlb_group).dropna()
            mlb_avg_evs = mlb_stats['avg_ev'].values
            mlb_max_evs = mlb_stats['max_ev'].values
            mlb_hard_hit_pcts = mlb_stats['hard_hit_pct'].values
            mlb_ss_pcts = mlb_stats['ss_pct'].values
        else:
            evs = mlb_df['launch_speed'].dropna()
            mlb_avg_evs = [evs.mean()]
            mlb_max_evs = [evs.max()]
            mlb_hard_hit_pcts = [(evs >= 95.0).mean() * 100.0]
            mlb_ss_pcts = [33.0]
            
    # 2. College Players
    if 'batter' not in college_df.columns:
        college_df['batter'] = 'College Batter'
        
    players = sorted(college_df['batter'].dropna().unique().tolist())
    HIT_EVENTS = {'single', 'double', 'triple', 'home_run'}
    result_data = {}
    
    for player in players:
        p_df = college_df[college_df['batter'] == player].copy()
        
        p_num = int(p_df['batter_num'].iloc[0]) if 'batter_num' in p_df.columns and pd.notna(p_df['batter_num'].iloc[0]) else None
        p_pos = str(p_df['batter_pos'].iloc[0]) if 'batter_pos' in p_df.columns and pd.notna(p_df['batter_pos'].iloc[0]) else 'Hitter'
        p_arch = str(p_df['batter_archetype'].iloc[0]) if 'batter_archetype' in p_df.columns and pd.notna(p_df['batter_archetype'].iloc[0]) else 'Batter Profile'

        pitches = []
        for _, row in p_df.iterrows():
            ev = float(row['launch_speed']) if pd.notna(row.get('launch_speed')) else None
            la = float(row['launch_angle']) if pd.notna(row.get('launch_angle')) else None
            zone = int(row['zone']) if pd.notna(row.get('zone')) else None
            event = str(row['events']) if pd.notna(row.get('events')) else 'field_out'
            ptype = str(row['pitch_type']) if pd.notna(row.get('pitch_type')) else 'Pitch'
            
            if pd.notna(row.get('plate_x')) and pd.notna(row.get('plate_z')):
                px = float(row['plate_x'])
                pz = float(row['plate_z'])
            elif zone in ZONE_CENTERS:
                cx, cz = ZONE_CENTERS[zone]
                px = cx + float(np.random.normal(0, 0.08))
                pz = cz + float(np.random.normal(0, 0.08))
            else:
                px = float(np.random.normal(0, 0.4))
                pz = float(np.random.normal(2.5, 0.5))
                
            is_hit = event.lower() in HIT_EVENTS
            is_hh = ev is not None and ev >= 95.0
            is_ss = la is not None and (8.0 <= la <= 32.0)
            is_barrel = is_hh and is_ss
            
            pitches.append({
                "x": round(px, 2),
                "z": round(pz, 2),
                "ev": round(ev, 1) if ev is not None else 0.0,
                "la": round(la, 1) if la is not None else 0.0,
                "zone": zone if zone is not None else 5,
                "event": event,
                "pitch_type": ptype,
                "is_hit": is_hit,
                "is_hard_hit": is_hh,
                "is_sweet_spot": is_ss,
                "is_barrel": is_barrel
            })
            
        # 3. 3x3 Strike Zone Data (Zones 1-9)
        zone_data = []
        for z in range(1, 10):
            z_bip = [p for p in pitches if p['zone'] == z]
            z_total = len(z_bip)
            if z_total > 0:
                z_hh = sum(1 for p in z_bip if p['is_hard_hit'])
                hh_rate = z_hh / z_total
                avg_ev = sum(p['ev'] for p in z_bip) / z_total
                avg_la = sum(p['la'] for p in z_bip) / z_total
            else:
                z_hh = 0
                hh_rate = 0.0
                avg_ev = 0.0
                avg_la = 0.0
                
            zone_data.append({
                "zone": z,
                "hardHitRate": hh_rate,
                "total": z_total,
                "hardHits": z_hh,
                "avgEv": round(avg_ev, 1),
                "avgLa": round(avg_la, 1)
            })
            
        # 4. Overall Stats & MLB Percentiles
        valid_evs = [p['ev'] for p in pitches if p['ev'] > 0]
        valid_las = [p['la'] for p in pitches]
        
        p_avg_ev = float(np.mean(valid_evs)) if len(valid_evs) > 0 else 0.0
        p_max_ev = float(np.max(valid_evs)) if len(valid_evs) > 0 else 0.0
        p_hh_pct = (sum(1 for p in pitches if p['is_hard_hit']) / len(pitches) * 100.0) if len(pitches) > 0 else 0.0
        p_ss_pct = (sum(1 for p in pitches if p['is_sweet_spot']) / len(pitches) * 100.0) if len(pitches) > 0 else 0.0
        p_avg_la = float(np.mean(valid_las)) if len(valid_las) > 0 else 0.0
        
        hits_count = sum(1 for p in pitches if p['is_hit'])
        outs_count = len(pitches) - hits_count
        hr_count = sum(1 for p in pitches if p['event'].lower() == 'home_run')
        barrels_count = sum(1 for p in pitches if p['is_barrel'])
        
        if len(mlb_avg_evs) > 1:
            pct_avg_ev = float(stats.percentileofscore(mlb_avg_evs, p_avg_ev, kind='rank'))
            pct_max_ev = float(stats.percentileofscore(mlb_max_evs, p_max_ev, kind='rank'))
            pct_hh = float(stats.percentileofscore(mlb_hard_hit_pcts, p_hh_pct, kind='rank'))
            pct_ss = float(stats.percentileofscore(mlb_ss_pcts, p_ss_pct, kind='rank'))
        else:
            pct_avg_ev, pct_max_ev, pct_hh, pct_ss = 50.0, 50.0, 50.0, 50.0
            
        percentiles = {
            "avg_ev": {"value": round(p_avg_ev, 1), "percentile": round(pct_avg_ev, 1)},
            "max_ev": {"value": round(p_max_ev, 1), "percentile": round(pct_max_ev, 1)},
            "hard_hit_pct": {"value": round(p_hh_pct, 1), "percentile": round(pct_hh, 1)},
            "sweet_spot": {"value": round(p_ss_pct, 1), "percentile": round(pct_ss, 1)}
        }
        
        summary = {
            "total_bip": len(pitches),
            "avg_ev": round(p_avg_ev, 1),
            "max_ev": round(p_max_ev, 1),
            "hard_hit_pct": round(p_hh_pct, 1),
            "sweet_spot_pct": round(p_ss_pct, 1),
            "avg_la": round(p_avg_la, 1),
            "hits": hits_count,
            "outs": outs_count,
            "home_runs": hr_count,
            "barrels": barrels_count,
            "babip": round(hits_count / len(pitches), 3) if len(pitches) > 0 else 0.000
        }
        
        la_dist = {
            "hits": [{"la": p['la'], "ev": p['ev'], "event": p['event'], "is_barrel": p['is_barrel']} for p in pitches if p['is_hit']],
            "outs": [{"la": p['la'], "ev": p['ev'], "event": p['event'], "is_barrel": p['is_barrel']} for p in pitches if not p['is_hit']]
        }
        
        result_data[player] = {
            "meta": {
                "num": p_num,
                "pos": p_pos,
                "archetype": p_arch
            },
            "summary": summary,
            "pitches": pitches,
            "zoneData": zone_data,
            "percentiles": percentiles,
            "laDist": la_dist
        }
        
    return {
        "players": players,
        "data": result_data,
        "mlb_sample_size": len(mlb_avg_evs)
    }

@app.get("/api/sample")
def get_sample_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mlb_path = os.path.join(base_dir, "mlb_mock.csv")
    college_path = os.path.join(base_dir, "college_mock.csv")
    
    if not os.path.exists(mlb_path) or not os.path.exists(college_path):
        return {"error": "Mock datasets not found on server."}
        
    mlb_df = pd.read_csv(mlb_path)
    college_df = pd.read_csv(college_path)
    return process_dfs(mlb_df, college_df)

@app.post("/api/analyze")
async def analyze_data(
    mlb_file: UploadFile = File(...),
    college_file: UploadFile = File(...)
):
    try:
        mlb_df = pd.read_csv(mlb_file.file)
        college_df = pd.read_csv(college_file.file)
        return process_dfs(mlb_df, college_df)
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

@app.get("/")
def serve_index():
    return FileResponse(
        os.path.join(frontend_dir, "index.html"),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
