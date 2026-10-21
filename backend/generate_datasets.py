import os
import random
import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

def get_zone(x, z):
    if -0.83 <= x <= 0.83 and 1.5 <= z <= 3.5:
        col = 0 if x < -0.28 else (1 if x <= 0.28 else 2)
        row = 0 if z > 2.83 else (1 if z >= 2.17 else 2)
        return row * 3 + col + 1
    else:
        if x < 0 and z > 2.5: return 11
        elif x >= 0 and z > 2.5: return 12
        elif x < 0 and z <= 2.5: return 13
        else: return 14

def sample_zone_coords(target_zone):
    zone_centers = {
        1: (-0.55, 3.16), 2: (0.0, 3.16), 3: (0.55, 3.16),
        4: (-0.55, 2.50), 5: (0.0, 2.50), 6: (0.55, 2.50),
        7: (-0.55, 1.84), 8: (0.0, 1.84), 9: (0.55, 1.84),
        11: (-1.10, 3.30), 12: (1.10, 3.30), 13: (-1.10, 1.70), 14: (1.10, 1.70)
    }
    cx, cz = zone_centers.get(target_zone, (0.0, 2.50))
    x = float(np.random.normal(cx, 0.18))
    z = float(np.random.normal(cz, 0.22))
    x = max(-1.6, min(1.6, x))
    z = max(0.9, min(4.2, z))
    actual_zone = get_zone(x, z)
    return round(x, 2), round(z, 2), actual_zone

PITCH_TYPES = ['4-Seam Fastball', 'Slider', 'Changeup', 'Curveball', 'Cutter', 'Sinker']

# ==========================================
# 1. 40 COMPLETELY FICTIONAL COLLEGE PLAYERS
# ==========================================
COLLEGE_ROSTER = [
    # Power Sluggers (target_ss between 0.31 and 0.37)
    {"name": "Lucas Vance", "num": 24, "pos": "OF", "archetype": "Power Slugger", "target_ss": 0.36, "hot_zones": [4, 5, 8], "n_bip": 52},
    {"name": "Derek Sterling", "num": 15, "pos": "3B", "archetype": "Power Slugger", "target_ss": 0.34, "hot_zones": [2, 5, 6], "n_bip": 48},
    {"name": "Colton Hayes", "num": 33, "pos": "1B", "archetype": "Power Slugger", "target_ss": 0.32, "hot_zones": [5, 7, 8], "n_bip": 50},
    {"name": "Marcus Brody", "num": 44, "pos": "DH", "archetype": "Power Slugger", "target_ss": 0.33, "hot_zones": [1, 4, 5], "n_bip": 46},
    {"name": "Travis Holloway", "num": 28, "pos": "1B", "archetype": "Power Slugger", "target_ss": 0.31, "hot_zones": [5, 6, 9], "n_bip": 42},
    {"name": "Julian Briggs", "num": 27, "pos": "C", "archetype": "Power Slugger", "target_ss": 0.35, "hot_zones": [4, 5, 8], "n_bip": 40},

    # Gap-to-Gap Line Drive Hitters (target_ss between 0.36 and 0.41)
    {"name": "Grant Keller", "num": 7, "pos": "SS", "archetype": "Line Drive Hitter", "target_ss": 0.39, "hot_zones": [2, 5, 8], "n_bip": 54},
    {"name": "Nate Donovan", "num": 10, "pos": "2B", "archetype": "Line Drive Hitter", "target_ss": 0.40, "hot_zones": [4, 5, 6], "n_bip": 50},
    {"name": "Wyatt Mercer", "num": 3, "pos": "OF", "archetype": "Line Drive Hitter", "target_ss": 0.38, "hot_zones": [1, 2, 4], "n_bip": 48},
    {"name": "Chase Montgomery", "num": 12, "pos": "C", "archetype": "Line Drive Hitter", "target_ss": 0.37, "hot_zones": [5, 6, 8], "n_bip": 45},
    {"name": "Tyler Callahan", "num": 21, "pos": "OF", "archetype": "Line Drive Hitter", "target_ss": 0.38, "hot_zones": [3, 5, 6], "n_bip": 44},
    {"name": "Austin Rhodes", "num": 9, "pos": "2B", "archetype": "Line Drive Hitter", "target_ss": 0.39, "hot_zones": [4, 5, 7], "n_bip": 47},
    {"name": "Preston Blake", "num": 16, "pos": "OF", "archetype": "Line Drive Hitter", "target_ss": 0.37, "hot_zones": [2, 4, 5], "n_bip": 41},
    {"name": "Trevor Finch", "num": 19, "pos": "3B", "archetype": "Line Drive Hitter", "target_ss": 0.36, "hot_zones": [5, 8, 9], "n_bip": 38},

    # Contact / Speed Tablesetters (target_ss between 0.28 and 0.34)
    {"name": "Cameron Shaw", "num": 2, "pos": "CF", "archetype": "Contact Specialist", "target_ss": 0.33, "hot_zones": [5, 7, 8], "n_bip": 55},
    {"name": "Derrick Lawson", "num": 5, "pos": "IF", "archetype": "Contact Specialist", "target_ss": 0.31, "hot_zones": [4, 5, 8], "n_bip": 45},
    {"name": "Garrett Boone", "num": 1, "pos": "LF", "archetype": "Contact Specialist", "target_ss": 0.29, "hot_zones": [1, 4, 7], "n_bip": 43},
    {"name": "Spencer Reed", "num": 11, "pos": "UT", "archetype": "Contact Specialist", "target_ss": 0.32, "hot_zones": [2, 5, 6], "n_bip": 39},
    {"name": "Brady Thornton", "num": 6, "pos": "CF", "archetype": "Contact Specialist", "target_ss": 0.30, "hot_zones": [5, 8, 9], "n_bip": 36},
    {"name": "Zachary Cole", "num": 4, "pos": "2B", "archetype": "Contact Specialist", "target_ss": 0.28, "hot_zones": [3, 5, 6], "n_bip": 35},
    {"name": "Mateo Ramos", "num": 13, "pos": "SS", "archetype": "Contact Specialist", "target_ss": 0.31, "hot_zones": [4, 5, 7], "n_bip": 34},

    # Flyball / Uppercut Hitters (target_ss between 0.28 and 0.33)
    {"name": "Evan Davenport", "num": 18, "pos": "LF", "archetype": "Flyball Hitter", "target_ss": 0.31, "hot_zones": [5, 7, 8], "n_bip": 46},
    {"name": "Caleb Whitmore", "num": 22, "pos": "RF", "archetype": "Flyball Hitter", "target_ss": 0.29, "hot_zones": [4, 5, 8], "n_bip": 44},
    {"name": "Dominic Russo", "num": 25, "pos": "OF", "archetype": "Flyball Hitter", "target_ss": 0.32, "hot_zones": [2, 5, 8], "n_bip": 40},
    {"name": "Gavin Fletcher", "num": 31, "pos": "OF", "archetype": "Flyball Hitter", "target_ss": 0.30, "hot_zones": [5, 6, 9], "n_bip": 37},
    {"name": "Julian Cruz", "num": 35, "pos": "DH", "archetype": "Flyball Hitter", "target_ss": 0.28, "hot_zones": [1, 2, 5], "n_bip": 38},

    # Groundball / Low Launch Angle Hitters (target_ss between 0.23 and 0.27)
    {"name": "Mason Crandall", "num": 14, "pos": "3B", "archetype": "Groundball Hitter", "target_ss": 0.24, "hot_zones": [5, 7, 8], "n_bip": 47},
    {"name": "Troy Dalton", "num": 30, "pos": "C", "archetype": "Groundball Hitter", "target_ss": 0.26, "hot_zones": [2, 5, 8], "n_bip": 41},
    {"name": "Nathan Ramsey", "num": 8, "pos": "2B", "archetype": "Groundball Hitter", "target_ss": 0.25, "hot_zones": [5, 8, 9], "n_bip": 39},
    {"name": "Zach York", "num": 23, "pos": "OF", "archetype": "Groundball Hitter", "target_ss": 0.24, "hot_zones": [4, 5, 7], "n_bip": 36},
    {"name": "Hunter Caldwell", "num": 32, "pos": "1B", "archetype": "Groundball Hitter", "target_ss": 0.25, "hot_zones": [5, 6, 8], "n_bip": 35},

    # Balanced Starters / Depth (target_ss between 0.30 and 0.36)
    {"name": "Dean Sullivan", "num": 17, "pos": "C", "archetype": "Balanced Hitter", "target_ss": 0.33, "hot_zones": [4, 5, 8], "n_bip": 42},
    {"name": "Parker Lowe", "num": 20, "pos": "OF", "archetype": "Balanced Hitter", "target_ss": 0.35, "hot_zones": [2, 5, 6], "n_bip": 39},
    {"name": "Shane Barrett", "num": 26, "pos": "UT", "archetype": "Balanced Hitter", "target_ss": 0.32, "hot_zones": [5, 7, 8], "n_bip": 36},
    {"name": "Gabriel Aris", "num": 29, "pos": "IF", "archetype": "Balanced Hitter", "target_ss": 0.34, "hot_zones": [3, 5, 6], "n_bip": 35},
    {"name": "Harrison Knox", "num": 34, "pos": "OF", "archetype": "Balanced Hitter", "target_ss": 0.33, "hot_zones": [1, 4, 5], "n_bip": 34},
    {"name": "Cody Malone", "num": 36, "pos": "IF", "archetype": "Balanced Hitter", "target_ss": 0.30, "hot_zones": [5, 8, 9], "n_bip": 32},
    {"name": "Sean Winslow", "num": 37, "pos": "1B", "archetype": "Balanced Hitter", "target_ss": 0.35, "hot_zones": [4, 5, 7], "n_bip": 33},
    {"name": "Owen Sterling", "num": 38, "pos": "C", "archetype": "Balanced Hitter", "target_ss": 0.31, "hot_zones": [2, 4, 5], "n_bip": 30},
    {"name": "Cole McIntyre", "num": 40, "pos": "OF", "archetype": "Balanced Hitter", "target_ss": 0.32, "hot_zones": [5, 6, 8], "n_bip": 31}
]

college_rows = []

for p in COLLEGE_ROSTER:
    arch = p["archetype"]
    hot_zones = p["hot_zones"]
    target_ss = p["target_ss"]
    
    for _ in range(p["n_bip"]):
        r = random.random()
        if r < 0.45:
            target_zone = random.choice(hot_zones)
        elif r < 0.85:
            target_zone = random.choice([1, 2, 3, 4, 5, 6, 7, 8, 9])
        else:
            target_zone = random.choice([11, 12, 13, 14])
            
        x, z, actual_zone = sample_zone_coords(target_zone)
        is_heart = actual_zone == 5 or actual_zone in hot_zones
        is_chase = actual_zone in [11, 12, 13, 14]
        
        # Exit Velocity based on archetype
        if "Power" in arch:
            base_ev = np.random.normal(92.5, 7.0)
            if is_heart: base_ev += random.uniform(4.0, 9.0)
            if is_chase: base_ev -= random.uniform(5.0, 10.0)
        elif "Line Drive" in arch:
            base_ev = np.random.normal(89.5, 5.5)
            if is_heart: base_ev += random.uniform(3.0, 6.5)
            if is_chase: base_ev -= random.uniform(4.0, 8.0)
        elif "Contact" in arch:
            base_ev = np.random.normal(86.5, 4.5)
            if is_heart: base_ev += random.uniform(2.0, 5.0)
            if is_chase: base_ev -= random.uniform(3.0, 7.0)
        elif "Flyball" in arch:
            base_ev = np.random.normal(88.5, 6.0)
            if is_heart: base_ev += random.uniform(3.0, 7.0)
            if is_chase: base_ev -= random.uniform(4.0, 8.5)
        elif "Groundball" in arch:
            base_ev = np.random.normal(87.5, 5.5)
            if is_heart: base_ev += random.uniform(2.5, 6.0)
            if is_chase: base_ev -= random.uniform(4.0, 8.0)
        else:
            base_ev = np.random.normal(88.0, 5.5)
            if is_heart: base_ev += random.uniform(2.5, 6.0)
            if is_chase: base_ev -= random.uniform(4.0, 8.0)
            
        ev = max(62.0, min(115.0, float(base_ev)))
        
        # Controlled Launch Angle generation for realistic Sweet Spot %
        if random.random() < target_ss:
            # Inside Sweet Spot (8° to 32°)
            la = float(np.random.uniform(8.5, 31.5))
        else:
            # Outside Sweet Spot
            if "Groundball" in arch:
                p_ground = 0.75
            elif "Flyball" in arch:
                p_ground = 0.25
            else:
                p_ground = 0.55
                
            if random.random() < p_ground:
                la = float(np.random.uniform(-20.0, 7.8))
            else:
                la = float(np.random.uniform(32.2, 58.0))
                
        # Determine event
        # Statcast Barrels: EV >= 95 and LA between 8 and 32 (often 12 to 32)
        if ev >= 100.0 and 20.0 <= la <= 34.0:
            event = "home_run"
        elif ev >= 95.0 and 12.0 <= la <= 28.0 and random.random() < 0.75:
            event = "double"
        elif ev >= 90.0 and 8.0 <= la <= 22.0 and random.random() < 0.7:
            event = "single"
        elif ev >= 84.0 and 10.0 <= la <= 20.0 and random.random() < 0.5:
            event = "single"
        elif ev >= 98.0 and 16.0 <= la <= 26.0 and random.random() < 0.2:
            event = "triple"
        elif la < 8.0:
            if ev > 95.0 and random.random() < 0.35:
                event = "single"
            elif random.random() < 0.15:
                event = "grounded_into_dp"
            else:
                event = "field_out"
        elif la > 36.0:
            if ev > 103.0 and random.random() < 0.2:
                event = "home_run"
            else:
                event = "field_out"
        else:
            event = "single" if random.random() < 0.35 else "field_out"
            
        college_rows.append({
            "batter": p["name"],
            "batter_num": p["num"],
            "batter_pos": p["pos"],
            "batter_archetype": p["archetype"],
            "plate_x": x,
            "plate_z": z,
            "zone": actual_zone,
            "launch_speed": round(ev, 1),
            "launch_angle": round(la, 1),
            "events": event,
            "pitch_type": random.choice(PITCH_TYPES)
        })

college_df = pd.DataFrame(college_rows)
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
college_path = os.path.join(base_dir, "college_mock.csv")
frontend_col_path = os.path.join(base_dir, "frontend", "college_mock.csv")
college_df.to_csv(college_path, index=False)
college_df.to_csv(frontend_col_path, index=False)
print(f"Generated college_mock.csv with {len(college_df)} rows across {len(COLLEGE_ROSTER)} made-up players.")

# ==========================================
# 2. MLB BENCHMARK (141 Players with Realistic Sweet Spot %)
# ==========================================
MLB_PLAYERS = [
    ("Aaron Judge", 96.2, 121.5, 0.58, 0.38),
    ("Shohei Ohtani", 95.8, 119.8, 0.56, 0.37),
    ("Giancarlo Stanton", 95.5, 122.2, 0.57, 0.32),
    ("Yordan Alvarez", 94.6, 117.8, 0.53, 0.39),
    ("Bobby Witt Jr.", 93.8, 116.5, 0.51, 0.36),
    ("Juan Soto", 94.2, 116.0, 0.52, 0.40),
    ("Vladimir Guerrero Jr.", 94.0, 117.4, 0.51, 0.36),
    ("Oneil Cruz", 94.8, 122.4, 0.54, 0.30),
    ("Kyle Schwarber", 93.5, 115.8, 0.50, 0.37),
    ("Gunnar Henderson", 93.2, 115.2, 0.49, 0.36),
    ("Rafael Devers", 93.4, 115.6, 0.50, 0.38),
    ("Pete Alonso", 92.8, 116.2, 0.48, 0.34),
    ("Matt Olson", 93.0, 116.0, 0.49, 0.36),
    ("Fernando Tatis Jr.", 93.1, 116.4, 0.48, 0.35),
    ("Austin Riley", 92.6, 115.0, 0.47, 0.35),
    ("Bryce Harper", 92.5, 115.5, 0.47, 0.38),
    ("Corey Seager", 92.2, 114.2, 0.46, 0.41),
    ("Freddie Freeman", 91.8, 113.5, 0.45, 0.42),
    ("Mookie Betts", 91.2, 111.8, 0.42, 0.40),
    ("Jose Ramirez", 90.8, 112.5, 0.41, 0.37),
    ("Kyle Tucker", 91.4, 112.8, 0.43, 0.38),
    ("Marcell Ozuna", 92.4, 115.0, 0.47, 0.36),
    ("Adley Rutschman", 90.5, 111.2, 0.40, 0.39),
    ("Francisco Lindor", 90.8, 112.0, 0.41, 0.36),
    ("William Contreras", 91.5, 113.8, 0.44, 0.37),
    ("Christian Yelich", 91.0, 113.2, 0.42, 0.38),
    ("Teoscar Hernandez", 92.0, 115.1, 0.46, 0.34),
    ("Riley Greene", 91.6, 114.0, 0.44, 0.38),
    ("Jackson Chourio", 90.7, 112.4, 0.40, 0.34),
    ("Brent Rooker", 92.3, 115.4, 0.46, 0.35),
    ("Seiya Suzuki", 91.2, 113.0, 0.42, 0.39),
    ("Marcus Semien", 89.8, 110.5, 0.38, 0.37),
    ("Anthony Santander", 90.6, 112.5, 0.40, 0.35),
    ("Royce Lewis", 91.0, 113.0, 0.41, 0.36),
    ("Josh Naylor", 90.4, 111.8, 0.39, 0.36),
    ("Alec Bohm", 90.2, 111.2, 0.39, 0.38),
    ("Elly De La Cruz", 91.2, 119.2, 0.43, 0.31),
    ("Corbin Carroll", 89.2, 110.2, 0.36, 0.37),
    ("Cody Bellinger", 89.5, 110.8, 0.37, 0.38),
    ("Bryan Reynolds", 89.8, 111.2, 0.38, 0.38),
    ("Manny Machado", 90.1, 112.0, 0.39, 0.36),
    ("Ozzie Albies", 88.8, 109.5, 0.34, 0.35),
    ("Willy Adames", 89.7, 111.0, 0.37, 0.35),
    ("Ian Happ", 89.1, 110.0, 0.35, 0.38),
    ("Gleyber Torres", 89.0, 109.8, 0.35, 0.37),
    ("Dansby Swanson", 88.9, 109.5, 0.34, 0.35),
    ("Lourdes Gurriel Jr.", 89.4, 110.4, 0.36, 0.36),
    ("Bo Bichette", 89.6, 110.8, 0.37, 0.37),
    ("Alex Bregman", 89.0, 109.2, 0.35, 0.39),
    ("Nolan Arenado", 88.6, 108.8, 0.33, 0.36),
    ("Paul Goldschmidt", 89.3, 110.5, 0.36, 0.35),
    ("Ezequiel Tovar", 88.7, 109.0, 0.33, 0.34),
    ("Maikel Garcia", 88.5, 108.5, 0.33, 0.35),
    ("Colt Keith", 88.9, 109.2, 0.34, 0.37),
    ("Wyatt Langford", 90.2, 112.5, 0.39, 0.36),
    ("Jackson Merrill", 90.0, 111.8, 0.38, 0.38),
    ("Luis Arraez", 86.2, 103.5, 0.23, 0.42),
    ("Steven Kwan", 85.8, 102.8, 0.21, 0.41),
    ("Nico Hoerner", 86.5, 104.2, 0.25, 0.38),
    ("Jeff McNeil", 86.8, 104.8, 0.26, 0.38),
    ("Ke'Bryan Hayes", 88.2, 108.0, 0.32, 0.33),
    ("Brice Turang", 86.4, 103.8, 0.24, 0.36),
    ("Masataka Yoshida", 88.4, 107.5, 0.32, 0.39),
    ("Harold Ramirez", 88.0, 107.0, 0.31, 0.35),
    ("TJ Friedl", 86.0, 103.0, 0.22, 0.37),
    ("Jacob Young", 85.4, 101.5, 0.19, 0.35),
    ("Bryson Stott", 87.2, 105.5, 0.28, 0.37),
    ("Ha-Seong Kim", 87.0, 105.0, 0.27, 0.36),
    ("Tommy Edman", 86.9, 104.9, 0.27, 0.36),
    ("Jonah Bride", 87.5, 106.0, 0.29, 0.37),
    ("Will Smith", 89.2, 110.0, 0.36, 0.38),
    ("Sal Frelick", 86.1, 103.2, 0.22, 0.36),
    ("Joey Ortiz", 87.8, 106.5, 0.30, 0.37),
    ("Zach Neto", 88.5, 108.2, 0.33, 0.36),
    ("Tyler Fitzgerald", 89.5, 111.0, 0.37, 0.34),
    ("Pete Crow-Armstrong", 87.4, 105.8, 0.28, 0.34),
    ("Martin Maldonado", 84.8, 102.0, 0.20, 0.29),
    ("Nick Ahmed", 85.0, 102.5, 0.21, 0.31),
    ("Austin Hedges", 83.5, 99.5, 0.16, 0.27),
    ("Myles Straw", 84.2, 100.8, 0.18, 0.33),
    ("Victor Robles", 85.5, 103.0, 0.22, 0.34),
    ("Jose Trevino", 85.2, 102.2, 0.21, 0.32),
    ("Kyle Higashioka", 86.5, 105.0, 0.26, 0.31),
    ("Nick Senzel", 85.9, 103.5, 0.23, 0.33),
    ("Leody Taveras", 86.8, 105.2, 0.27, 0.34),
    ("Christian Bethancourt", 86.0, 104.0, 0.24, 0.30),
    ("Nick Martini", 85.6, 103.2, 0.22, 0.32),
    ("Andrew Knizner", 84.9, 101.8, 0.20, 0.30),
    ("DJ Stewart", 86.5, 105.5, 0.26, 0.32),
    ("Jake Rogers", 86.8, 106.0, 0.27, 0.31),
    ("Garrett Hampson", 85.1, 102.4, 0.21, 0.33),
    ("Johan Rojas", 85.3, 102.8, 0.21, 0.34),
    ("Luke Maile", 84.5, 101.0, 0.19, 0.30),
    ("Travis d'Arnaud", 87.0, 106.2, 0.28, 0.34),
    ("Amed Rosario", 86.7, 105.0, 0.26, 0.35),
    ("Kevin Pillar", 86.3, 104.5, 0.25, 0.33)
]

for i in range(1, 46):
    archetype_choice = random.choice(["slugger", "above_avg", "avg", "contact", "below_avg"])
    if archetype_choice == "slugger":
        target_avg = round(np.random.normal(92.5, 0.8), 1)
        target_max = round(np.random.normal(115.5, 1.5), 1)
        target_hh = round(np.random.uniform(0.46, 0.52), 2)
        target_ss = round(np.random.uniform(0.33, 0.38), 2)
    elif archetype_choice == "above_avg":
        target_avg = round(np.random.normal(90.5, 0.7), 1)
        target_max = round(np.random.normal(111.5, 1.2), 1)
        target_hh = round(np.random.uniform(0.39, 0.44), 2)
        target_ss = round(np.random.uniform(0.34, 0.39), 2)
    elif archetype_choice == "avg":
        target_avg = round(np.random.normal(88.5, 0.6), 1)
        target_max = round(np.random.normal(108.5, 1.2), 1)
        target_hh = round(np.random.uniform(0.33, 0.38), 2)
        target_ss = round(np.random.uniform(0.31, 0.36), 2)
    elif archetype_choice == "contact":
        target_avg = round(np.random.normal(86.5, 0.7), 1)
        target_max = round(np.random.normal(104.5, 1.2), 1)
        target_hh = round(np.random.uniform(0.23, 0.28), 2)
        target_ss = round(np.random.uniform(0.36, 0.42), 2)
    else:
        target_avg = round(np.random.normal(85.0, 0.7), 1)
        target_max = round(np.random.normal(102.5, 1.2), 1)
        target_hh = round(np.random.uniform(0.18, 0.23), 2)
        target_ss = round(np.random.uniform(0.26, 0.32), 2)
        
    MLB_PLAYERS.append((f"MLB Player {i}", target_avg, target_max, target_hh, target_ss))

mlb_rows = []

for name, avg_ev, max_ev, hh_pct, ss_pct in MLB_PLAYERS:
    n_bip = random.randint(35, 45)
    for j in range(n_bip):
        if j == 0:
            ev = max_ev
        else:
            ev = float(np.random.normal(avg_ev, 5.8))
            ev = min(max_ev - 0.2, max(60.0, ev))
            
        if random.random() < ss_pct:
            la = float(np.random.uniform(8.5, 31.5))
        else:
            if random.random() < 0.55:
                la = float(np.random.uniform(-20.0, 7.8))
            else:
                la = float(np.random.uniform(32.2, 58.0))
                
        mlb_rows.append({
            "batter": name,
            "launch_speed": round(ev, 1),
            "launch_angle": round(la, 1)
        })

mlb_df = pd.DataFrame(mlb_rows)
mlb_path = os.path.join(base_dir, "mlb_mock.csv")
frontend_mlb_path = os.path.join(base_dir, "frontend", "mlb_mock.csv")
mlb_df.to_csv(mlb_path, index=False)
mlb_df.to_csv(frontend_mlb_path, index=False)
print(f"Generated mlb_mock.csv with {len(mlb_df)} rows across {len(MLB_PLAYERS)} MLB players.")
