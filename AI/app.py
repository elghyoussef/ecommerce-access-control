from flask import Flask, render_template
import pandas as pd
import joblib
from math import ceil
import json
from datetime import datetime
import numpy as np
from geopy.geocoders import Nominatim

app = Flask(__name__)

ITEMS_PER_PAGE = 10
LOG_PATH = "../login_attempts.log"

# Load models at startup
vpn_model = joblib.load('vpn_model.pkl')
sus_model = joblib.load('sus_model.pkl')

# Helper to extract features for AI model
COUNTRY_MAP = {'FR': 'France', 'US': 'USA', 'MA': 'Morocco'}
def get_country_from_code(code):
    return COUNTRY_MAP.get(str(code).upper(), str(code))

def extract_features(row, prev_row=None):
    # VPN features
    country = row.get('country', '')
    timezone = row.get('timezone', '')
    # Travel features
    if prev_row is not None and (row['email'] == prev_row['email']) and (row['timestamp'] - prev_row['timestamp']).total_seconds() <= 3600:
        from geopy.distance import geodesic
        distance = geodesic((prev_row['latitude'], prev_row['longitude']), (row['latitude'], row['longitude'])).km
        time_diff = (row['timestamp'] - prev_row['timestamp']).total_seconds() / 3600
        speed = distance / max(time_diff, 0.01)
        country_change = int(get_country_from_code(prev_row['country']) != get_country_from_code(row['country']))
        first_login = 0
    else:
        distance = 0
        speed = 0
        country_change = 0
        # Only set first_login=1 if this is the first row for this user (no previous row or previous row is a different user)
        first_login = 1 if prev_row is None or row['email'] != prev_row['email'] else 0
    return {
        'country': country,
        'timezone': timezone,
        'distance': distance,
        'speed': speed,
        'country_change': country_change,
        'first_login': first_login
    }

def load_logs():
    try:
        with open(LOG_PATH, "r") as f:
            logs = [json.loads(line) for line in f if line.strip()]
        parsed_logs = []
        for log in logs:
            geo = log.get('geoInfo', {})
            timestamp = datetime.strptime(log['timestamp'], "%Y-%m-%dT%H:%M:%S.%fZ")
            parsed_logs.append({
                'timestamp': timestamp,
                'email': log['email'],
                'username': log.get('username', ''),
                'ip': log.get('ip', ''),
                'geo_ip': geo.get('ip', ''),  # <-- add geo_ip field
                'success': log['success'],
                'reason': log.get('reason', ''),
                'latitude': geo.get('latitude'),
                'longitude': geo.get('longitude'),
                'timezone': geo.get('timezone'),
                'country': geo.get('country') or '',
            })
        return pd.DataFrame(parsed_logs)
    except Exception as e:
        print(f"Error loading logs: {e}")
        return pd.DataFrame()

coord_cache = {}
def resolve_country_from_coords(lat, lon):
    if lat is None or lon is None:
        return None
    key = (round(float(lat), 4), round(float(lon), 4))
    if key in coord_cache:
        return coord_cache[key]
    geolocator = Nominatim(user_agent="vpn_model")
    try:
        location = geolocator.reverse(f"{lat}, {lon}", exactly_one=True, timeout=2, language='en')
        country = location.raw.get('address', {}).get('country')
        coord_cache[key] = country
        return country
    except:
        return None

def resolve_country_from_timezone(tz):
    if not tz:
        return None
    # Map timezone to country using a lookup for common cases
    tz_map = {
        'Africa/Casablanca': 'Morocco',
        'Europe/London': 'United Kingdom',
        'Europe/Paris': 'France',
        # Add more as needed
    }
    return tz_map.get(tz, tz.split('/')[-1])

def get_country_from_code(ip):
    # For localhost, assume Morocco for demo
    if ip in ['::1', '127.0.0.1']:
        return 'Morocco'
    # Use GeoLite2 or similar for real IPs
    try:
        import geoip2.database
        reader = geoip2.database.Reader('GeoLite2-Country.mmdb')
        response = reader.country(ip)
        country = response.country.name
        reader.close()
        return country
    except Exception:
        return None

def analyze_logs(log_df, all_logs_df=None):
    # all_logs_df: full DataFrame of all logs, needed for true first_login detection
    if all_logs_df is None:
        all_logs_df = log_df
    # Precompute first login timestamp per user
    first_login_map = all_logs_df.groupby('email')['timestamp'].min().to_dict()
    results = []
    prev_row = None
    prev_feats = None
    prev_vpn_pred = None
    prev_sus_pred = None
    prev_sus_reason_str = None
    for idx, row in log_df.iterrows():
        geo_ip = row.get('geo_ip', '')
        ip_country = get_country_from_code(geo_ip)
        coord_country = resolve_country_from_coords(row['latitude'], row['longitude'])
        tz_country = resolve_country_from_timezone(row['timezone'])
        # True first_login logic
        is_true_first_login = row['timestamp'] == first_login_map.get(row['email'])
        feats = extract_features(row, prev_row)
        feats['first_login'] = 1 if is_true_first_login else 0
        # VPN logic: always use current row's country sources
        def norm_country(c):
            return c.lower().strip() if c else None
        norm_ip = norm_country(ip_country)
        norm_coord = norm_country(coord_country)
        norm_tz = norm_country(tz_country)
        if all([norm_ip, norm_coord, norm_tz]) and norm_ip == norm_coord == norm_tz and norm_ip != '':
            vpn_pred = 0
        else:
            vpn_pred = 1
        # Suspicious logic (travel features assigned to next row as before)
        sus_X = pd.DataFrame([{k: feats[k] for k in ['distance', 'speed', 'country_change', 'first_login']}])
        sus_X['vpn'] = vpn_pred
        sus_X = sus_X[sus_model.feature_names_in_]
        if feats['first_login'] and all([norm_ip, norm_coord, norm_tz]) and norm_ip == norm_coord == norm_tz and norm_ip != '':
            sus_pred = 0
        elif feats['first_login'] and row['success']:
            sus_pred = 0
        else:
            sus_pred = sus_model.predict(sus_X)[0]
        sus_reason = []
        # Ignore very small distances (<1 km) for speed/distance logic
        if feats['distance'] < 1:
            feats['distance'] = 0
            feats['speed'] = 0
        # Enhanced suspicious reasons (successful logins only suspicious for strong anomalies)
        strong_anomaly = False
        if feats['speed'] > 900 and feats['distance'] >= 1:
            time_diff_h = (prev_row['timestamp'] - row['timestamp']).total_seconds() / 3600 if prev_row is not None else 0
            if time_diff_h < 1:
                mins = int(time_diff_h * 60)
                time_str = f"{mins} minutes"
            else:
                h = int(time_diff_h)
                mins = int((time_diff_h - h) * 60)
                time_str = f"{h} hours {mins} minutes"
            sus_reason.append(f"Unrealistic travel: {feats['distance']:.1f} km in {time_str} (impossible speed between logins)")
            strong_anomaly = True
        if feats['country_change']:
            prev_country = get_country_from_code(prev_row['country']) if prev_row is not None else 'Unknown'
            curr_country = get_country_from_code(row['country'])
            sus_reason.append(f"Location changed: Previous login from {prev_country}, now from {curr_country}")
            strong_anomaly = True
        # Multiple failed attempts (only flag if current login is also a failure)
        if all_logs_df is not None:
            recent_attempts = all_logs_df[(all_logs_df['email'] == row['email']) & (all_logs_df['timestamp'] < row['timestamp'])].tail(5)
            failed_count = (recent_attempts['success'] == False).sum()
            if failed_count >= 3 and not row['success']:
                sus_reason.append(f"Account security: {failed_count} failed login attempts in last 5 tries")
            # Multiple failed then success (only if all failures were very recent, e.g., within 10 minutes)
            if failed_count >= 2 and row['success']:
                if not recent_attempts.empty and (row['timestamp'] - recent_attempts.iloc[-1]['timestamp']).total_seconds() < 600:
                    sus_reason.append(f"Brute-force risk: Multiple failed logins followed by a success in short time")
                    strong_anomaly = True
        # Multiple locations in short time
        if all_logs_df is not None and prev_row is not None:
            recent_locations = all_logs_df[(all_logs_df['email'] == row['email']) & (all_logs_df['timestamp'] < row['timestamp'])].tail(5)
            unique_countries = recent_locations['country'].nunique()
            if unique_countries > 2:
                sus_reason.append(f"Travel anomaly: {unique_countries} different countries in last 5 logins")
                strong_anomaly = True
        # VPN/Proxy detection logic
        if vpn_pred:
            strong_anomaly = True
        # Only flag as suspicious if there is a real anomaly or the model is very confident
        if not sus_reason and sus_pred and not row['success']:
            sus_reason.append('Suspicious activity detected by AI model (pattern not matching normal behavior)')
        sus_reason_str = '; '.join(sus_reason) if sus_reason else ''
        # Set suspicious flag: for successful logins, only if strong anomaly
        suspicious_flag = 'Yes' if (not row['success'] and (sus_reason or sus_pred)) or (row['success'] and strong_anomaly) else 'No'
        # Assign travel features and sus_reason to the NEXT row, but VPN is always for current row
        if prev_feats is not None:
            for k in ['distance', 'speed', 'country_change', 'first_login']:
                results[-1][k] = feats[k]
            results[-1]['sus_reason'] = sus_reason_str
            results[-1]['suspicious'] = suspicious_flag
        # Prepare the result for the current row (will be updated on the next iteration)
        result = {
            'timestamp': row['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
            'email': row['email'],
            'username': row['username'],
            'ip': row['geo_ip'],
            'geo_ip': row['geo_ip'],
            'success': "✅" if row['success'] else "❌",
            'reason': row['reason'],
            'vpn': 'Yes' if vpn_pred else 'No',
            'suspicious': None,
            'sus_reason': '',
            'distance': 0,
            'speed': 0,
            'country_change': 0,
            'first_login': 1,
            'ip_country': ip_country,
            'coord_country': coord_country,
            'tz_country': tz_country
        }
        results.append(result)
        prev_row = row
        prev_feats = feats
        prev_sus_pred = sus_pred if 'sus_pred' in locals() else None
        prev_sus_reason_str = sus_reason_str
    # For the last row, fill in the current values
    if results:
        results[-1]['distance'] = prev_feats['distance'] if prev_feats else 0
        results[-1]['speed'] = prev_feats['speed'] if prev_feats else 0
        results[-1]['country_change'] = prev_feats['country_change'] if prev_feats else 0
        results[-1]['first_login'] = prev_feats['first_login'] if prev_feats else 0
        results[-1]['suspicious'] = suspicious_flag
        results[-1]['sus_reason'] = prev_sus_reason_str if prev_sus_reason_str else ''
    return results

def predict_vpn_and_sus(login_row, X_vpn_columns):
    # Prepare features for VPN model (country, timezone)
    vpn_X = pd.get_dummies(pd.DataFrame([{
        'country': login_row['country'],
        'timezone': login_row['timezone']
    }]))
    # Ensure all columns match those used during training
    for col in X_vpn_columns:
        if col not in vpn_X.columns:
            vpn_X[col] = False
    vpn_X = vpn_X[X_vpn_columns]
    vpn_pred = vpn_model.predict(vpn_X)[0]
    # Prepare features for suspicious model
    sus_X = pd.DataFrame([{k: login_row[k] for k in ['vpn', 'distance', 'speed', 'country_change', 'first_login']}])
    sus_pred = sus_model.predict(sus_X)[0]
    return int(vpn_pred), int(sus_pred)

@app.route('/')
@app.route('/page/<int:page>')
def index(page=1):
    log_df = load_logs()
    if log_df.empty:
        return render_template('index.html',
                           actions=[],
                           current_page=1,
                           total_pages=1,
                           total_items=0)
    log_df = log_df.iloc[::-1].reset_index(drop=True)
    total_items = len(log_df)
    total_pages = ceil(total_items / ITEMS_PER_PAGE)
    page = max(1, min(page, total_pages))
    start_idx = (page - 1) * ITEMS_PER_PAGE
    page_logs = log_df.iloc[start_idx : start_idx + ITEMS_PER_PAGE]
    results = analyze_logs(page_logs, log_df)  # Pass the full log_df for true first_login detection
    return render_template('index.html',
                         actions=results,
                         current_page=page,
                         total_pages=total_pages,
                         total_items=total_items)

if __name__ == '__main__':
    app.run(debug=True)
